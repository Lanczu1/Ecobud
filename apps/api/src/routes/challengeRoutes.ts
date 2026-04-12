import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../prismaClient';
import { authenticateRequest, AuthenticatedRequest, requireUserAccess } from '../http/authentication';
import { errorBoundary, HttpError } from '../http/errorResponder';
import { GamificationService } from '../services/GamificationService';

const challengeRoutes = Router();
const gamificationService = new GamificationService();

const progressSchema = z.object({
  progressPercentage: z.number().int().min(0).max(100),
});

const submissionSchema = z
  .object({
    proofText: z.string().min(10).max(1000).optional(),
    proofUrl: z.string().url().optional(),
  })
  .refine((payload) => Boolean(payload.proofText ?? payload.proofUrl), {
    message: 'Provide proof text or a proof URL.',
    path: ['proofText'],
  });

challengeRoutes.get(
  '/active',
  authenticateRequest,
  requireUserAccess,
  errorBoundary(async (req: AuthenticatedRequest, res) => {
    const userId = req.auth!.userId;
    const challenges = await prisma.challenge.findMany({
      where: { active: true },
      include: {
        userChallenges: {
          where: { userId },
          take: 1,
        },
      },
      orderBy: [{ difficulty: 'asc' }, { title: 'asc' }],
    });

    return res.json({
      items: challenges.map((challenge) => ({
        ...challenge,
        progress: challenge.userChallenges[0] ?? null,
      })),
    });
  }),
);

challengeRoutes.post(
  '/:challengeId/progress',
  authenticateRequest,
  requireUserAccess,
  errorBoundary(async (req: AuthenticatedRequest, res) => {
    const payload = progressSchema.parse(req.body);
    const result = await gamificationService.updateChallengeProgress(
      req.auth!.userId,
      req.params.challengeId,
      payload.progressPercentage,
    );

    return res.json(result);
  }),
);

challengeRoutes.get(
  '/submissions/mine',
  authenticateRequest,
  requireUserAccess,
  errorBoundary(async (req: AuthenticatedRequest, res) => {
    const items = await prisma.challengeSubmission.findMany({
      where: { userId: req.auth!.userId },
      include: {
        challenge: true,
        reviewer: {
          include: {
            profile: true,
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    return res.json({ items });
  }),
);

challengeRoutes.post(
  '/:challengeId/submissions',
  authenticateRequest,
  requireUserAccess,
  errorBoundary(async (req: AuthenticatedRequest, res) => {
    const payload = submissionSchema.parse(req.body);
    const challenge = await prisma.challenge.findUnique({
      where: { id: req.params.challengeId },
      select: {
        id: true,
        active: true,
      },
    });

    if (!challenge || !challenge.active) {
      throw new HttpError(404, 'Active challenge not found.');
    }

    const submission = await prisma.challengeSubmission.upsert({
      where: {
        userId_challengeId: {
          userId: req.auth!.userId,
          challengeId: challenge.id,
        },
      },
      update: {
        proofText: payload.proofText,
        proofUrl: payload.proofUrl,
        status: 'pending',
        moderatorNotes: null,
        flaggedReason: null,
        reviewedById: null,
        reviewedAt: null,
      },
      create: {
        userId: req.auth!.userId,
        challengeId: challenge.id,
        proofText: payload.proofText,
        proofUrl: payload.proofUrl,
      },
    });

    return res.status(201).json({ submission });
  }),
);

challengeRoutes.get(
  '/streaks/summary',
  authenticateRequest,
  requireUserAccess,
  errorBoundary(async (req: AuthenticatedRequest, res) => {
    const user = await prisma.user.findUnique({
      where: { id: req.auth!.userId },
      select: {
        currentStreak: true,
        lastActionDate: true,
      },
    });

    return res.json({
      currentStreak: user?.currentStreak ?? 0,
      lastActionDate: user?.lastActionDate ?? null,
    });
  }),
);

export { challengeRoutes };
