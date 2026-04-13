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
  date: z.string(),
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
  },
) => {
  const submission = await prisma.challengeSubmission.findUnique({
    where: { id: submissionId },
  });

  if (!submission) {
    throw new HttpError(404, 'Challenge submission not found.');
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
      challenge: true,
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
      orderBy: { date: 'asc' },
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
        ...payload,
        date: new Date(payload.date),
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
        ...payload,
        date: new Date(payload.date),
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
  errorBoundary(async (req, res) => {
    const status = submissionStatusFilterSchema.parse(
      typeof req.query.status === 'string' ? req.query.status : undefined,
    );
    const items = await prisma.challengeSubmission.findMany({
      where: {
        status,
      },
      include: {
        challenge: true,
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
      },
    );

    await supabaseRealtimeService.publishUserSectionBundle(
      item.userId,
      ['challenges', 'tracker'],
      {
        actorRole: req.auth!.role,
        actorUserId: req.auth!.userId,
        entityId: item.challengeId,
        reason: 'submission-approved',
      },
    );

    await supabaseRealtimeService.publishUserNotice(item.userId, {
      level: 'success',
      message: `Your proof for "${item.challenge.title}" has been approved.`,
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
      },
    );

    await supabaseRealtimeService.publishUserSectionBundle(
      item.userId,
      ['challenges', 'tracker'],
      {
        actorRole: req.auth!.role,
        actorUserId: req.auth!.userId,
        entityId: item.challengeId,
        reason: 'submission-rejected',
      },
    );

    await supabaseRealtimeService.publishUserNotice(item.userId, {
      level: 'warning',
      message: `Your proof for "${item.challenge.title}" was rejected.${payload.moderatorNotes ? ` Notes: ${payload.moderatorNotes}` : ''}`,
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
      },
    );

    await supabaseRealtimeService.publishUserSectionBundle(
      item.userId,
      ['challenges', 'tracker'],
      {
        actorRole: req.auth!.role,
        actorUserId: req.auth!.userId,
        entityId: item.challengeId,
        reason: 'submission-flagged',
      },
    );

    await supabaseRealtimeService.publishUserNotice(item.userId, {
      level: 'warning',
      message: `Your proof for "${item.challenge.title}" needs attention.${payload.moderatorNotes ? ` Notes: ${payload.moderatorNotes}` : ''}`,
      scope: 'moderation',
      title: 'Challenge flagged',
    });

    return res.json({ item });
  }),
);

export { moderationRoutes };
