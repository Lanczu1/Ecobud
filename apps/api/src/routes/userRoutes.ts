import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../prismaClient';
import { authenticateRequest, AuthenticatedRequest, requireUserAccess } from '../http/authentication';
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
  requireUserAccess,
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
      name: user?.name,
      email: user?.email,
      role: user?.role,
      status: user?.status,
      points: user?.points ?? 0,
      currentStreak: user?.currentStreak ?? 0,
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
          user?.lessonProgress.filter((item) => item.status === 'completed').length ?? 0,
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
  requireUserAccess,
  errorBoundary(async (req: AuthenticatedRequest, res) => {
    const payload = preferenceSchema.parse(req.body);
    const result = await prisma.$transaction(async (tx) => {
      if (payload.displayName) {
        await tx.user.update({
          where: { id: req.auth!.userId },
          data: {
            name: payload.displayName,
          },
        });
      }

      const profile = await tx.profile.upsert({
        where: { userId: req.auth!.userId },
        update: {
          displayName: payload.displayName,
          headline: payload.headline,
          city: payload.city,
          preferencesJson: payload.preferences ? JSON.stringify(payload.preferences) : undefined,
        },
        create: {
          userId: req.auth!.userId,
          displayName: payload.displayName ?? req.auth!.name,
          headline: payload.headline,
          city: payload.city,
          preferencesJson: payload.preferences ? JSON.stringify(payload.preferences) : undefined,
        },
      });

      const user = await tx.user.findUnique({
        where: { id: req.auth!.userId },
        select: {
          name: true,
        },
      });

      return {
        profile,
        name: user?.name ?? req.auth!.name,
      };
    });

    return res.json(result);
  }),
);

export { userRoutes };
