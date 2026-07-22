import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../prismaClient';
import { authenticateRequest, AuthenticatedRequest, requireUserAccess } from '../http/authentication';
import { errorBoundary, HttpError } from '../http/errorResponder';
import { resolveLiveStreak } from '../utils/gamificationUtils';
import { avatarUploadMiddleware } from '../http/uploadMiddleware';
import { PasswordService } from '../security/passwordService';

const userRoutes = Router();

const preferenceSchema = z.object({
  displayName: z.string().min(2).max(50).optional(),
  headline: z.string().max(120).optional(),
  city: z.string().max(80).optional(),
  preferences: z.record(z.string(), z.union([z.string(), z.boolean(), z.number()])).optional(),
});

const securitySchema = z.object({
  currentPassword: z.string(),
  newEmail: z.string().email().optional(),
  newPassword: z.string().min(8).optional(),
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
      currentStreak: resolveLiveStreak(user?.currentStreak ?? 0, user?.lastActionDate),
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

userRoutes.post(
  '/me/avatar',
  authenticateRequest,
  requireUserAccess,
  avatarUploadMiddleware.single('image'),
  errorBoundary(async (req: AuthenticatedRequest, res) => {
    console.log('[API] /me/avatar hit, req.file:', req.file);
    if (!req.file) {
      throw new HttpError(400, 'Image file is required');
    }

    const avatarUrl = `/uploads/Avatars/${req.file.filename}`;

    const profile = await prisma.profile.upsert({
      where: { userId: req.auth!.userId },
      update: { avatarUrl },
      create: {
        userId: req.auth!.userId,
        displayName: req.auth!.name,
        avatarUrl,
      },
    });

    return res.json({
      success: true,
      avatarUrl,
    });
  }),
);

userRoutes.patch(
  '/me/security',
  authenticateRequest,
  requireUserAccess,
  errorBoundary(async (req: AuthenticatedRequest, res) => {
    const payload = securitySchema.parse(req.body);
    
    const user = await prisma.user.findUnique({ where: { id: req.auth!.userId } });
    if (!user) {
      throw new HttpError(404, 'User not found');
    }

    const passwordMatches = await PasswordService.compare(payload.currentPassword, user.passwordHash);
    if (!passwordMatches) {
      throw new HttpError(401, 'Incorrect current password.');
    }

    const updateData: any = {};

    if (payload.newEmail && payload.newEmail !== user.email) {
      const existingUser = await prisma.user.findUnique({ where: { email: payload.newEmail } });
      if (existingUser) {
        throw new HttpError(409, 'This email is already taken.');
      }
      updateData.email = payload.newEmail;
    }

    if (payload.newPassword) {
      updateData.passwordHash = await PasswordService.hash(payload.newPassword);
    }

    if (Object.keys(updateData).length > 0) {
      await prisma.user.update({
        where: { id: req.auth!.userId },
        data: updateData,
      });
    }

    return res.json({ success: true, message: 'Security settings updated.' });
  }),
);

export { userRoutes };
