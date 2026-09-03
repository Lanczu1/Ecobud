import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../prismaClient';
import { authenticateRequest, AuthenticatedRequest, requireModeratorAccess } from '../http/authentication';
import { HttpError, errorBoundary } from '../http/errorResponder';
import { supabaseRealtimeService } from '../services/supabaseRealtimeService';
import { GamificationService } from '../services/GamificationService';

const moderationRoutes = Router();
const gamificationService = new GamificationService();

const eventSchema = z.object({
  title: z.string().min(3),
  description: z.string().min(10),
  location: z.string().min(3),
  startDatetime: z.string(),
  endDatetime: z.string(),
  capacity: z.number().int().min(1).max(5000),
  pointsReward: z.number().int().min(1).max(300),
  imageUrl: z.string().url().optional().or(z.literal('')),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
});

const moderationDecisionSchema = z.object({
  moderatorNotes: z.string().max(500).optional(),
});

const submissionStatusFilterSchema = z
  .enum(['pending', 'approved', 'rejected', 'flagged'])
  .optional();

const flagSchema = z.object({
  reason: z.string().min(5).max(300),
  moderatorNotes: z.string().max(500).optional(),
});

const updateSubmissionStatus = async (
  submissionId: string,
  reviewerId: string,
  status: 'approved' | 'rejected' | 'flagged',
  options?: {
    moderatorNotes?: string;
    flaggedReason?: string;
    reviewerRole?: string;
    reviewerCity?: string | null;
  },
) => {
  const submission = await prisma.challengeSubmission.findUnique({
    where: { id: submissionId },
    include: {
      user: {
        include: {
          profile: true,
        },
      },
    },
  });

  if (!submission) {
    throw new HttpError(404, 'Challenge submission not found.');
  }

  if (options?.reviewerRole === 'moderator') {
    const assignedBarangay = options.reviewerCity?.trim().toLowerCase();
    const subBarangay = submission.user.profile?.city?.trim().toLowerCase();
    if (!assignedBarangay || assignedBarangay !== subBarangay) {
      throw new HttpError(403, 'Forbidden: You cannot moderate submissions outside your assigned barangay.');
    }
  }

  return prisma.challengeSubmission.update({
    where: { id: submissionId },
    data: {
      status,
      moderatorNotes: options?.moderatorNotes,
      flaggedReason: options?.flaggedReason ?? null,
      reviewedById: reviewerId,
      reviewedAt: new Date(),
    },
    include: {
      challengeInstance: { include: { challenge: true } },
      user: {
        include: {
          profile: true,
        },
      },
      reviewer: {
        include: {
          profile: true,
        },
      },
    },
  });
};

moderationRoutes.use(authenticateRequest, requireModeratorAccess);

moderationRoutes.get(
  '/dashboard',
  errorBoundary(async (_req, res) => {
    const [pendingSubmissions, flaggedSubmissions, managedEvents, pendingAttendance] =
      await Promise.all([
        prisma.challengeSubmission.count({ where: { status: 'pending' } }),
        prisma.challengeSubmission.count({ where: { status: 'flagged' } }),
        prisma.event.count(),
        prisma.eventRegistration.count({ where: { status: 'REGISTERED' } }),
      ]);

    return res.json({
      totals: {
        pendingSubmissions,
        flaggedSubmissions,
        managedEvents,
        pendingAttendance,
      },
    });
  }),
);

moderationRoutes.get(
  '/events',
  errorBoundary(async (_req, res) => {
    const items = await prisma.event.findMany({
      include: {
        managedBy: {
          include: {
            profile: true,
          },
        },
        registrations: {
          include: {
            user: {
              include: {
                profile: true,
              },
            },
          },
        },
      },
      orderBy: { startDatetime: 'asc' },
    });

    return res.json({ items });
  }),
);

moderationRoutes.post(
  '/events',
  errorBoundary(async (req: AuthenticatedRequest, res) => {
    const payload = eventSchema.parse(req.body);
    const item = await prisma.event.create({
      data: {
        title: payload.title,
        description: payload.description,
        location: payload.location,
        startDatetime: new Date(payload.startDatetime),
        endDatetime: new Date(payload.endDatetime),
        capacity: payload.capacity,
        expReward: payload.pointsReward,
        ecoCoinsReward: 0,
        imageUrl: payload.imageUrl,
        latitude: payload.latitude,
        longitude: payload.longitude,
        managedById: req.auth!.userId,
      },
    });

    return res.status(201).json({ item });
  }),
);

moderationRoutes.put(
  '/events/:eventId',
  errorBoundary(async (req, res) => {
    const payload = eventSchema.parse(req.body);
    const item = await prisma.event.update({
      where: { id: req.params.eventId },
      data: {
        title: payload.title,
        description: payload.description,
        location: payload.location,
        startDatetime: new Date(payload.startDatetime),
        endDatetime: new Date(payload.endDatetime),
        capacity: payload.capacity,
        expReward: payload.pointsReward,
        imageUrl: payload.imageUrl,
        latitude: payload.latitude,
        longitude: payload.longitude,
      },
    });

    return res.json({ item });
  }),
);

moderationRoutes.delete(
  '/events/:eventId',
  errorBoundary(async (req, res) =>
    res.json({ deleted: await prisma.event.delete({ where: { id: req.params.eventId } }) }),
  ),
);

moderationRoutes.post(
  '/events/:eventId/registrations/:registrationId/attend',
  errorBoundary(async (req, res) => {
    const result = await gamificationService.markEventAttendance(
      req.params.eventId,
      req.params.registrationId,
    );

    return res.json(result);
  }),
);

moderationRoutes.get(
  '/challenge-submissions',
  errorBoundary(async (req: AuthenticatedRequest, res) => {
    const status = submissionStatusFilterSchema.parse(
      typeof req.query.status === 'string' ? req.query.status : undefined,
    );

    const isModerator = req.auth?.role === 'moderator';
    const where: any = { status };

    if (isModerator && req.auth?.city) {
      where.user = {
        profile: {
          city: req.auth.city,
        },
      };
    }

    const items = await prisma.challengeSubmission.findMany({
      where,
      include: {
        challengeInstance: { include: { challenge: true } },
        user: {
          include: {
            profile: true,
          },
        },
        reviewer: {
          include: {
            profile: true,
          },
        },
      },
      orderBy: [{ updatedAt: 'desc' }],
    });

    return res.json({ items });
  }),
);

moderationRoutes.post(
  '/challenge-submissions/:submissionId/approve',
  errorBoundary(async (req: AuthenticatedRequest, res) => {
    const payload = moderationDecisionSchema.parse(req.body);
    const item = await updateSubmissionStatus(
      req.params.submissionId,
      req.auth!.userId,
      'approved',
      {
        moderatorNotes: payload.moderatorNotes,
        reviewerRole: req.auth!.role,
        reviewerCity: req.auth!.city,
      },
    );

    await supabaseRealtimeService.publishUserSectionBundle(
      item.userId,
      ['challenges', 'tracker'],
      {
        actorRole: req.auth!.role,
        actorUserId: req.auth!.userId,
        entityId: item.challengeInstanceId,
        reason: 'submission-approved',
      },
    );

    await supabaseRealtimeService.publishUserNotice(item.userId, {
      level: 'success',
      message: `Your proof for "${item.challengeInstance?.challenge.title}" has been approved.`,
      scope: 'moderation',
      title: 'Challenge approved',
    });

    return res.json({ item });
  }),
);

moderationRoutes.post(
  '/challenge-submissions/:submissionId/reject',
  errorBoundary(async (req: AuthenticatedRequest, res) => {
    const payload = moderationDecisionSchema.parse(req.body);
    const item = await updateSubmissionStatus(
      req.params.submissionId,
      req.auth!.userId,
      'rejected',
      {
        moderatorNotes: payload.moderatorNotes,
        reviewerRole: req.auth!.role,
        reviewerCity: req.auth!.city,
      },
    );

    await supabaseRealtimeService.publishUserSectionBundle(
      item.userId,
      ['challenges', 'tracker'],
      {
        actorRole: req.auth!.role,
        actorUserId: req.auth!.userId,
        entityId: item.challengeInstanceId,
        reason: 'submission-rejected',
      },
    );

    await supabaseRealtimeService.publishUserNotice(item.userId, {
      level: 'warning',
      message: `Your proof for "${item.challengeInstance?.challenge.title}" was rejected.${payload.moderatorNotes ? ` Notes: ${payload.moderatorNotes}` : ''}`,
      scope: 'moderation',
      title: 'Challenge review update',
    });

    return res.json({ item });
  }),
);

moderationRoutes.post(
  '/challenge-submissions/:submissionId/flag',
  errorBoundary(async (req: AuthenticatedRequest, res) => {
    const payload = flagSchema.parse(req.body);
    const item = await updateSubmissionStatus(
      req.params.submissionId,
      req.auth!.userId,
      'flagged',
      {
        flaggedReason: payload.reason,
        moderatorNotes: payload.moderatorNotes,
        reviewerRole: req.auth!.role,
        reviewerCity: req.auth!.city,
      },
    );

    await supabaseRealtimeService.publishUserSectionBundle(
      item.userId,
      ['challenges', 'tracker'],
      {
        actorRole: req.auth!.role,
        actorUserId: req.auth!.userId,
        entityId: item.challengeInstanceId,
        reason: 'submission-flagged',
      },
    );

    await supabaseRealtimeService.publishUserNotice(item.userId, {
      level: 'warning',
      message: `Your proof for "${item.challengeInstance?.challenge.title}" needs attention.${payload.moderatorNotes ? ` Notes: ${payload.moderatorNotes}` : ''}`,
      scope: 'moderation',
      title: 'Challenge flagged',
    });

    return res.json({ item });
  }),
);

export { moderationRoutes };
