import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../prismaClient';
import { authenticateRequest, AuthenticatedRequest } from '../http/authentication';
import { errorBoundary } from '../http/errorResponder';

const userRoutes = Router();

const preferenceSchema = z.object({
  displayName: z.string().min(2).max(50).optional(),
  headline: z.string().max(120).optional(),
  city: z.string().max(80).optional(),
  preferences: z.record(z.string(), z.union([z.string(), z.boolean(), z.number()])).optional(),
});

userRoutes.get(
  '/me',
  authenticateRequest,
  errorBoundary(async (req: AuthenticatedRequest, res) => {
    const user = await prisma.user.findUnique({
      where: { id: req.auth!.userId },
      include: {
        profile: true,
        badges: {
          include: { badge: true },
          orderBy: { unlockedAt: 'asc' },
        },
        eventRegistrations: {
          include: { event: true },
          orderBy: { registeredAt: 'desc' },
        },
        lessonProgress: true,
        challengeProgress: true,
      },
    });

    const recentLogs = await prisma.transparencyLog.findMany({
      where: { userId: req.auth!.userId },
      orderBy: { timestamp: 'desc' },
      take: 5,
    });

    return res.json({
      id: user?.id,
      email: user?.email,
      role: user?.role,
      points: user?.points ?? 0,
      currentStreak: user?.currentStreak ?? 0,
      highestStreak: user?.highestStreak ?? 0,
      profile: user?.profile,
      badges: user?.badges.map((item) => item.badge) ?? [],
      eventHistory:
        user?.eventRegistrations.map((item) => ({
          ...item.event,
          status: item.status,
          attendedAt: item.attendedAt,
        })) ?? [],
      progress: {
        lessonsCompleted:
          user?.lessonProgress.filter((item) => item.status === 'COMPLETED').length ?? 0,
        activeChallenges:
          user?.challengeProgress.filter((item) => item.status !== 'COMPLETED').length ?? 0,
      },
      recentLogs,
    });
  }),
);

userRoutes.patch(
  '/me/preferences',
  authenticateRequest,
  errorBoundary(async (req: AuthenticatedRequest, res) => {
    const payload = preferenceSchema.parse(req.body);
    const profile = await prisma.profile.upsert({
      where: { userId: req.auth!.userId },
      update: {
        displayName: payload.displayName,
        headline: payload.headline,
        city: payload.city,
        preferencesJson: payload.preferences ? JSON.stringify(payload.preferences) : undefined,
      },
      create: {
        userId: req.auth!.userId,
        displayName: payload.displayName ?? 'EcoBud Member',
        headline: payload.headline,
        city: payload.city,
        preferencesJson: payload.preferences ? JSON.stringify(payload.preferences) : undefined,
      },
    });

    return res.json({ profile });
  }),
);

export { userRoutes };
