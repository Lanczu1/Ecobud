import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../prismaClient';
import { authenticateRequest, AuthenticatedRequest } from '../http/authentication';
import { errorBoundary } from '../http/errorResponder';
import { GamificationService } from '../services/GamificationService';

const challengeRoutes = Router();
const gamificationService = new GamificationService();

const progressSchema = z.object({
  progressPercentage: z.number().int().min(0).max(100),
});

challengeRoutes.get(
  '/active',
  authenticateRequest,
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
  '/streaks/summary',
  authenticateRequest,
  errorBoundary(async (req: AuthenticatedRequest, res) => {
    const user = await prisma.user.findUnique({
      where: { id: req.auth!.userId },
      select: {
        currentStreak: true,
        highestStreak: true,
        lastActionDate: true,
      },
    });

    return res.json({
      currentStreak: user?.currentStreak ?? 0,
      highestStreak: user?.highestStreak ?? 0,
      lastActionDate: user?.lastActionDate ?? null,
    });
  }),
);

export { challengeRoutes };
