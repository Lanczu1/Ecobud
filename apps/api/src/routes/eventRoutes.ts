import { Router } from 'express';
import { prisma } from '../prismaClient';
import { authenticateRequest, AuthenticatedRequest, requireUserAccess } from '../http/authentication';
import { HttpError, errorBoundary } from '../http/errorResponder';
import { eventSubmissionUploadMiddleware } from '../http/uploadMiddleware';
import { GamificationService } from '../services/GamificationService';

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
      include: {
        registrations: true,
      },
      orderBy: { startDatetime: 'asc' },
    });

    return res.json({
      items: events.map((event) => {
        let userStatus = null;
        if (userId) {
          const userReg = event.registrations.find(r => r.userId === userId);
          if (userReg) {
            userStatus = userReg.status === 'ATTENDED' ? 'attended' : 'joined';
          }
        }
        
        return {
          ...event,
          spotsLeft: Math.max(0, event.capacity - event.registrations.length),
          userStatus,
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

    if (!event) {
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

    return res.status(201).json({ alreadyJoined: false, registration });
  }),
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

    const event = await prisma.event.findUnique({
      where: { id: eventId },
      include: { registrations: true },
    });

    if (!event) {
      throw new HttpError(404, 'Event not found.');
    }

    const registration = event.registrations.find((r) => r.userId === userId);
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
      // Validate QR
      const qrCode = await prisma.eventQrCode.findFirst({
        where: { eventId, qrData },
      });

      if (!qrCode) {
        throw new HttpError(400, 'Invalid QR code.');
      }

      if (now > new Date(qrCode.expiresAt)) {
        throw new HttpError(400, 'This QR code has expired.');
      }

      // Automatically mark as attended!
      const result = await gamificationService.markEventAttendance(eventId, registration.id);
      return res.json({ success: true, message: 'QR Code verified! Attendance recorded.', result });
    }

    if (req.file) {
      const imageUrl = `/uploads/EventSubmissions/${req.file.filename}`;
      const submission = await prisma.eventSubmission.upsert({
        where: { userId_eventId: { userId, eventId } },
        update: { attendanceImageUrl: imageUrl, status: 'pending' },
        create: {
          userId,
          eventId,
          attendanceImageUrl: imageUrl,
          status: 'pending',
        },
      });
      return res.json({ success: true, message: 'Submission uploaded. Pending review.', submission });
    }

    throw new HttpError(400, 'Please provide an image or scan a QR code.');
  })
);

export { eventRoutes };
