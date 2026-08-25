import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { prisma } from '../prismaClient';
import { authenticateRequest, AuthenticatedRequest, requireUserAccess } from '../http/authentication';
import { errorBoundary, HttpError } from '../http/errorResponder';
import { resolveLiveStreak } from '../utils/gamificationUtils';
import { avatarUploadMiddleware } from '../http/uploadMiddleware';
import { supabaseStorageService } from '../services/supabaseStorageService';
import { PasswordService } from '../security/passwordService';
import { TokenService } from '../security/tokenService';
import path from 'path';
import fs from 'fs';

const userRoutes = Router();

const securityUpdateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many security update attempts. Please try again in 15 minutes.' },
});

const preferenceSchema = z.object({
  displayName: z.string().min(2).max(50).optional(),
  email: z.string().email().optional(),
  headline: z.string().max(120).optional(),
  city: z.string().max(80).optional(),
  preferences: z.record(z.string(), z.union([z.string(), z.boolean(), z.number()])).optional(),
});

const securitySchema = z.object({
  currentPassword: z.string().min(1).max(100),
  newEmail: z.string().email().optional(),
  newPassword: z.string().min(8).max(100, 'New password cannot exceed 100 characters.').optional(),
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

    const currentUser = await prisma.user.findUnique({
      where: { id: req.auth!.userId },
    });
    if (!currentUser) {
      throw new HttpError(404, 'User not found.');
    }

    let normalizedEmail: string | undefined;
    if (payload.email) {
      normalizedEmail = payload.email.toLowerCase().trim();
      if (normalizedEmail !== currentUser.email) {
        const existingUser = await prisma.user.findUnique({
          where: { email: normalizedEmail },
        });
        if (existingUser && existingUser.id !== req.auth!.userId) {
          throw new HttpError(409, 'This email is already in use by another account.');
        }
      }
    }

    const result = await prisma.$transaction(async (tx) => {
      const userUpdateData: any = {};
      if (payload.displayName) {
        userUpdateData.name = payload.displayName;
      }
      if (normalizedEmail) {
        userUpdateData.email = normalizedEmail;
      }

      let updatedUser = currentUser;
      if (Object.keys(userUpdateData).length > 0) {
        updatedUser = await tx.user.update({
          where: { id: req.auth!.userId },
          data: userUpdateData,
        });
      }

      const profile = await tx.profile.upsert({
        where: { userId: req.auth!.userId },
        update: {
          displayName: payload.displayName ?? undefined,
          headline: payload.headline ?? undefined,
          city: payload.city !== undefined ? payload.city : undefined,
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

      const newToken = TokenService.sign({
        userId: updatedUser.id,
        name: updatedUser.name,
        email: updatedUser.email,
        role: updatedUser.role,
        status: updatedUser.status,
      });

      return {
        profile,
        name: updatedUser.name,
        email: updatedUser.email,
        token: newToken,
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
    if (!req.file) {
      throw new HttpError(400, 'Image file is required');
    }

    try {
      const ext = path.extname(req.file.originalname) || '.jpg';
      const destinationPath = `avatars/avatar-${req.auth!.userId}-${Date.now()}${ext}`;
      const avatarUrl = await supabaseStorageService.uploadFile(
        destinationPath,
        req.file.path,
        req.file.mimetype
      );

      // Clean up local temp file
      try {
        if (fs.existsSync(req.file.path)) {
          fs.unlinkSync(req.file.path);
        }
      } catch (e) {
        console.error('Failed to remove temp avatar file:', e);
      }

      await prisma.profile.upsert({
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
    } catch (error: any) {
      try {
        if (fs.existsSync(req.file.path)) {
          fs.unlinkSync(req.file.path);
        }
      } catch {}
      throw new HttpError(500, `Failed to upload avatar: ${error.message}`);
    }
  }),
);

userRoutes.patch(
  '/me/security',
  securityUpdateLimiter,
  authenticateRequest,
  requireUserAccess,
  errorBoundary(async (req: AuthenticatedRequest, res) => {
    const payload = securitySchema.parse(req.body);
    
    const user = await prisma.user.findUnique({ where: { id: req.auth!.userId } });
    if (!user) {
      throw new HttpError(404, 'User not found.');
    }

    const passwordMatches = await PasswordService.compare(payload.currentPassword, user.passwordHash);
    if (!passwordMatches) {
      throw new HttpError(401, 'Incorrect current password.');
    }

    const updateData: any = {};

    if (payload.newEmail) {
      const normalizedEmail = payload.newEmail.toLowerCase().trim();
      if (normalizedEmail !== user.email) {
        const existingUser = await prisma.user.findUnique({ where: { email: normalizedEmail } });
        if (existingUser) {
          throw new HttpError(409, 'This email is already in use by another account.');
        }
        updateData.email = normalizedEmail;
      }
    }

    if (payload.newPassword) {
      updateData.passwordHash = await PasswordService.hash(payload.newPassword);
    }

    let updatedUser = user;
    if (Object.keys(updateData).length > 0) {
      updatedUser = await prisma.user.update({
        where: { id: req.auth!.userId },
        data: updateData,
      });
    }

    const newToken = TokenService.sign({
      userId: updatedUser.id,
      name: updatedUser.name,
      email: updatedUser.email,
      role: updatedUser.role,
      status: updatedUser.status,
    });

    return res.json({
      success: true,
      message: 'Security settings updated successfully.',
      token: newToken,
    });
  }),
);

export { userRoutes };
