import { Router } from 'express';
import { prisma } from '../prismaClient';
import { authenticateRequest, AuthenticatedRequest, requireUserAccess } from '../http/authentication';
import { HttpError, errorBoundary } from '../http/errorResponder';
import { eventSubmissionUploadMiddleware } from '../http/uploadMiddleware';
import { supabaseStorageService } from '../services/supabaseStorageService';
import { GamificationService } from '../services/GamificationService';
import { supabaseRealtimeService } from '../services/supabaseRealtimeService';
import path from 'path';

const eventRoutes = Router();
const gamificationService = new GamificationService();

eventRoutes.get(
  '/',
  errorBoundary(async (req, res) => {
    let userId: string | undefined;

    const authorization = req.headers.authorization;
    if (authorization?.startsWith('Bearer ')) {
      const token = authorization.replace('Bearer ', '').trim();
      try {
        const { TokenService } = require('../security/tokenService');
        const session = TokenService.verify(token);
        userId = session.userId;
      } catch (err) {
        // Ignore invalid token for public route
      }
    }

    const events = await prisma.event.findMany({
      where: { isPublished: true },
      include: {
        _count: {
          select: { registrations: true }
        },
        registrations: userId ? {
          where: { userId },
          select: { status: true, attendedAt: true, userId: true },
          take: 1
        } : false,
        ...(userId ? { submissions: { where: { userId }, orderBy: { submittedAt: 'desc' }, take: 1 } } : {})
      },
      orderBy: [
        { isFeatured: 'desc' },
        { startDatetime: 'asc' },
      ],
    });

    return res.json({
      items: events.map((event) => {
        let userStatus = null;
        let rejectionReason = undefined;
        if (userId) {
          const userReg = event.registrations?.[0];
          const submission = (event as any).submissions?.[0];
          
          if (userReg) {
            userStatus =
              userReg.status === 'REWARD_CLAIMED'
                ? 'reward_claimed'
                : userReg.status === 'ATTENDED'
                ? 'attended'
                : userReg.status === 'PENDING_APPROVAL'
                ? 'pending_approval'
                : (submission?.status === 'rejected' ? 'rejected' : 'joined');
          }
          if (submission?.status === 'rejected') {
            rejectionReason = submission.rejectionReason || undefined;
          }
        }
        
        return {
          ...event,
          spotsLeft: Math.max(0, event.capacity - (event._count?.registrations ?? 0)),
          userStatus,
          rejectionReason,
          submissions: undefined,
        };
      }),
    });
  }),
);

eventRoutes.post(
  '/:eventId/join',
  authenticateRequest,
  requireUserAccess,
  errorBoundary(async (req: AuthenticatedRequest, res) => {
    const event = await prisma.event.findUnique({
      where: { id: req.params.eventId },
      include: { registrations: true },
    });

    if (!event || !event.isPublished) {
      throw new HttpError(404, 'Event not found.');
    }

    const existingRegistration = event.registrations.find(
      (registration) => registration.userId === req.auth!.userId,
    );

    if (existingRegistration) {
      return res.json({ alreadyJoined: true, registration: existingRegistration });
    }

    if (new Date() >= event.startDatetime) {
      throw new HttpError(400, 'Registration is closed. You can only join upcoming events.');
    }

    if (event.registrations.length >= event.capacity) {
      throw new HttpError(409, 'This event is already full.');
    }

    const registration = await prisma.eventRegistration.create({
      data: {
        userId: req.auth!.userId,
        eventId: event.id,
      },
    });
    void supabaseRealtimeService.publishUserEventsRefresh(req.auth!.userId, { entityId: event.id, reason: 'event-joined' });

    return res.status(201).json({ alreadyJoined: false, registration });
  }),
);

eventRoutes.post(
  '/:eventId/claim',
  authenticateRequest,
  requireUserAccess,
  errorBoundary(async (req: AuthenticatedRequest, res) => {
    const { eventId } = req.params;
    const userId = req.auth!.userId;

    const registration = await prisma.eventRegistration.findUnique({
      where: { userId_eventId: { userId, eventId } }
    });
    if (!registration) {
      throw new HttpError(404, 'Registration not found.');
    }
    const result = await gamificationService.markEventAttendance(eventId, registration.id);
    
    if (result.alreadyCompleted) {
      throw new HttpError(400, 'Reward already claimed.');
    }

    return res.status(200).json(result);
  })
);

eventRoutes.post(
  '/:eventId/submissions',
  authenticateRequest,
  requireUserAccess,
  eventSubmissionUploadMiddleware.single('image'),
  errorBoundary(async (req: AuthenticatedRequest, res) => {
    const { eventId } = req.params;
    const { qrData } = req.body;
    const userId = req.auth!.userId;

    const [event, registration, qrCode] = await Promise.all([
      prisma.event.findUnique({
        where: { id: eventId },
        select: { id: true, isPublished: true, startDatetime: true, endDatetime: true },
      }),
      prisma.eventRegistration.findUnique({
        where: { userId_eventId: { userId, eventId } },
      }),
      qrData ? prisma.eventQrCode.findFirst({ where: { qrData } }) : Promise.resolve(null),
    ]);

    if (!event || !event.isPublished) {
      throw new HttpError(404, 'Event not found.');
    }

    if (!registration) {
      throw new HttpError(400, 'You must join the event before recording attendance.');
    }

    if (registration.status === 'ATTENDED') {
      throw new HttpError(400, 'You have already recorded attendance for this event.');
    }

    const now = new Date();
    if (now < new Date(event.startDatetime) || now > new Date(event.endDatetime)) {
      throw new HttpError(400, 'Attendance can only be recorded while the event is ongoing.');
    }

    if (qrData) {
      if (!qrCode) {
        throw new HttpError(400, 'Invalid QR code.');
      }

      if (qrCode.eventId !== eventId) {
        throw new HttpError(400, 'This QR code belongs to a different event.');
      }

      if (now > new Date(qrCode.expiresAt)) {
        throw new HttpError(400, 'This QR code has expired.');
      }
    }

    if (!req.file) {
      throw new HttpError(400, 'Please provide an image for attendance proof.');
    }

    try {
      const ext = path.extname(req.file.originalname) || '.jpg';
      const destinationPath = `events/submissions/event-${eventId}-${userId}-${Date.now()}${ext}`;
      const imageUrl = await supabaseStorageService.uploadFile(
        destinationPath,
        req.file.path,
        req.file.mimetype
      );

      const [submission] = await Promise.all([
        prisma.eventSubmission.upsert({
          where: { userId_eventId: { userId, eventId } },
          update: { attendanceImageUrl: imageUrl, qrVerified: Boolean(qrData), status: 'pending' },
          create: {
            userId,
            eventId,
            attendanceImageUrl: imageUrl,
            qrVerified: Boolean(qrData),
            status: 'pending',
          },
        }),
        // Preserve the existing review state while writing both independent records together.
        prisma.eventRegistration.update({
          where: { id: registration.id },
          data: { status: 'PENDING_APPROVAL' },
        }),
      ]);
      void supabaseRealtimeService.publishUserEventsRefresh(userId, { entityId: eventId, reason: 'event-attendance-submitted' });

      return res.json({ success: true, message: 'Submission uploaded. Pending review.', submission });
    } catch (error: any) {
      throw new HttpError(500, `Failed to upload event attendance proof: ${error.message}`);
    }
  })
);

export { eventRoutes };

