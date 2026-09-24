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
import { emailChangeKey, emailCodeHash, sendEmailChangeCode } from '../security/emailChange';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { createTotpSecret, createTotpUri, encryptTotpSecret, decryptTotpSecret, verifyTotp, makeRecoveryCodes, hashRecoveryCode } from '../security/totp';

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
  currentPassword: z.string().min(1).max(100).optional(),
  newEmail: z.string().email().optional(),
  emailCode: z.string().regex(/^\d{6}$/).optional(),
  newPassword: z.string().min(8).max(72).regex(/[a-zA-Z]/).regex(/[0-9]/).refine(value => Buffer.byteLength(value, 'utf8') <= 72, 'Password must be at most 72 bytes.').optional(),
});

function issueMobileSessionTokens(user: { id: string; name: string; email: string; role: 'user' | 'moderator' | 'admin'; status: 'active' | 'pending' | 'suspended'; sessionVersion: number; profile?: { city?: string | null } | null }) {
  const authTime = Math.floor(Date.now() / 1000);
  return {
    token: TokenService.sign({ userId: user.id, name: user.name, email: user.email, role: user.role, status: user.status, city: user.profile?.city ?? null, sessionVersion: user.sessionVersion, clientType: 'mobile', authTime }),
    refreshToken: TokenService.signRefresh({ userId: user.id, sessionVersion: user.sessionVersion, authTime }),
  };
}

userRoutes.get(
  '/me',
  authenticateRequest,
  requireUserAccess,
  errorBoundary(async (req: AuthenticatedRequest, res) => {
    const user = await prisma.user.findUnique({
      where: { id: req.auth!.userId },
      select: {
        id: true,
        name: true,
        email: true,
        googleIdentityId: true,
        role: true,
        status: true,
        points: true,
        currentStreak: true,
        lastActionDate: true,
        profile: true,
        badges: {
          select: {
            badge: true,
          },
          orderBy: { unlockedAt: 'asc' },
        },
        eventRegistrations: {
          select: {
            status: true,
            attendedAt: true,
            event: true,
          },
          orderBy: { registeredAt: 'desc' },
        },
        lessonProgress: {
          select: {
            status: true,
          },
        },
        challengeProgress: {
          select: {
            status: true,
          },
        },
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
      isGoogleAccount: user?.googleIdentityId != null,
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
    if (req.auth!.role !== 'user' && payload.city !== undefined && payload.city !== req.auth!.city) {
      throw new HttpError(403, 'Privileged account jurisdictions cannot be changed through profile preferences.');
    }

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
        throw new HttpError(400, 'Change your email through security settings with password confirmation and email verification.');
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
        sessionVersion: updatedUser.sessionVersion,
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
      throw new HttpError(500, 'Failed to upload avatar.');
    }
  }),
);

userRoutes.get('/me/mfa/totp', authenticateRequest, requireUserAccess, errorBoundary(async (req: AuthenticatedRequest, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.auth!.userId }, select: { totpEnabledAt: true, id: true } });
  if (!user) throw new HttpError(404, 'User not found.');
  const remainingRecoveryCodes = await prisma.mfaRecoveryCode.count({ where: { userId: user.id, usedAt: null } });
  return res.json({ enabled: Boolean(user.totpEnabledAt), enabledAt: user.totpEnabledAt, remainingRecoveryCodes });
}));

userRoutes.post('/me/mfa/totp/enroll', authenticateRequest, requireUserAccess, securityUpdateLimiter,
  errorBoundary(async (req: AuthenticatedRequest, res) => {
    const authTime = req.auth!.authTime ?? 0;
    if (Math.floor(Date.now() / 1000) - authTime > 10 * 60) {
      throw new HttpError(403, 'For security, sign in again before setting up an authenticator app.');
    }
    const user = await prisma.user.findUnique({ where: { id: req.auth!.userId }, select: { id: true, email: true, totpEnabledAt: true } });
    if (!user) throw new HttpError(404, 'User not found.');
    if (user.totpEnabledAt) throw new HttpError(409, 'An authenticator app is already enabled.');
    const secret = createTotpSecret();
    const id = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 10 * 60_000);
    await prisma.mfaEnrollment.deleteMany({ where: { userId: user.id } });
    await prisma.mfaEnrollment.create({ data: { id, userId: user.id, secretEncrypted: encryptTotpSecret(secret), expiresAt } });
    return res.json({ enrollmentId: id, secret, otpauthUri: createTotpUri(user.email, secret), expiresAt: expiresAt.toISOString() });
  }));

const totpConfirmSchema = z.object({ enrollmentId: z.string().uuid(), code: z.string().regex(/^\d{6}$/) });
userRoutes.post('/me/mfa/totp/confirm', authenticateRequest, requireUserAccess, securityUpdateLimiter,
  errorBoundary(async (req: AuthenticatedRequest, res) => {
    const payload = totpConfirmSchema.parse(req.body);
    const enrollment = await prisma.mfaEnrollment.findFirst({ where: { id: payload.enrollmentId, userId: req.auth!.userId, expiresAt: { gt: new Date() } } });
    if (!enrollment) throw new HttpError(400, 'Authenticator setup expired. Start setup again.');
    const secret = decryptTotpSecret(enrollment.secretEncrypted);
    const step = verifyTotp(secret, payload.code);
    if (step === null) throw new HttpError(400, 'That code is invalid. Check your authenticator app and try again.');
    const recoveryCodes = makeRecoveryCodes();
    const updatedUser = await prisma.$transaction(async (tx) => {
      const updated = await tx.user.updateMany({ where: { id: req.auth!.userId, totpEnabledAt: null }, data: { totpSecretEncrypted: enrollment.secretEncrypted, totpEnabledAt: new Date(), totpLastUsedStep: BigInt(step), sessionVersion: { increment: 1 } } });
      if (updated.count !== 1) throw new HttpError(409, 'Authenticator setup has already been completed.');
      await tx.mfaRecoveryCode.deleteMany({ where: { userId: req.auth!.userId } });
      await tx.mfaRecoveryCode.createMany({ data: recoveryCodes.map((code) => ({ userId: req.auth!.userId, codeHash: hashRecoveryCode(code) })) });
      await tx.mfaEnrollment.deleteMany({ where: { userId: req.auth!.userId } });
      return tx.user.findUniqueOrThrow({ where: { id: req.auth!.userId }, include: { profile: true } });
    });
    return res.json({ success: true, recoveryCodes, ...issueMobileSessionTokens(updatedUser) });
  }));

const totpCodeSchema = z.object({ code: z.string().trim().min(6).max(32) });
userRoutes.post('/me/mfa/recovery-codes/rotate', authenticateRequest, requireUserAccess, securityUpdateLimiter,
  errorBoundary(async (req: AuthenticatedRequest, res) => {
    const { code } = totpCodeSchema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { id: req.auth!.userId }, select: { id: true, totpSecretEncrypted: true, totpEnabledAt: true, totpLastUsedStep: true } });
    if (!user?.totpEnabledAt || !user.totpSecretEncrypted) throw new HttpError(409, 'Enable an authenticator app first.');
    const step = verifyTotp(decryptTotpSecret(user.totpSecretEncrypted), code.replace(/[\s-]/g, ''));
    if (step === null) throw new HttpError(401, 'Enter a valid authenticator code to rotate recovery codes.');
    const recoveryCodes = makeRecoveryCodes();
    await prisma.$transaction(async (tx) => {
      const accepted = await tx.user.updateMany({ where: { id: user.id, OR: [{ totpLastUsedStep: null }, { totpLastUsedStep: { lt: BigInt(step) } }] }, data: { totpLastUsedStep: BigInt(step) } });
      if (accepted.count !== 1) throw new HttpError(401, 'That authenticator code has already been used. Try the next code.');
      await tx.mfaRecoveryCode.deleteMany({ where: { userId: user.id } });
      await tx.mfaRecoveryCode.createMany({ data: recoveryCodes.map((recoveryCode) => ({ userId: user.id, codeHash: hashRecoveryCode(recoveryCode) })) });
    });
    return res.json({ recoveryCodes });
  }));

userRoutes.post('/me/mfa/disable', authenticateRequest, requireUserAccess, securityUpdateLimiter,
  errorBoundary(async (req: AuthenticatedRequest, res) => {
    const { code } = totpCodeSchema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { id: req.auth!.userId }, include: { profile: true } });
    if (!user?.totpEnabledAt || !user.totpSecretEncrypted) throw new HttpError(409, 'Authenticator app is not enabled.');
    const normalizedCode = code.replace(/[\s-]/g, '').toUpperCase();
    const step = verifyTotp(decryptTotpSecret(user.totpSecretEncrypted), normalizedCode);
    const updatedUser = await prisma.$transaction(async (tx) => {
      if (step !== null) {
        const accepted = await tx.user.updateMany({ where: { id: user.id, OR: [{ totpLastUsedStep: null }, { totpLastUsedStep: { lt: BigInt(step) } }] }, data: { totpLastUsedStep: BigInt(step) } });
        if (accepted.count !== 1) throw new HttpError(401, 'That authenticator code has already been used. Try the next code.');
      } else {
        const rows = await tx.mfaRecoveryCode.findMany({ where: { userId: user.id, usedAt: null } });
        const hash = hashRecoveryCode(normalizedCode);
        const match = rows.find((row) => {
          const expected = Buffer.from(row.codeHash, 'hex'); const actual = Buffer.from(hash, 'hex');
          return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
        });
        if (!match) throw new HttpError(401, 'Enter a valid authenticator code or unused recovery code.');
        const consumed = await tx.mfaRecoveryCode.updateMany({ where: { id: match.id, usedAt: null }, data: { usedAt: new Date() } });
        if (consumed.count !== 1) throw new HttpError(401, 'That recovery code has already been used.');
      }
      await tx.mfaRecoveryCode.deleteMany({ where: { userId: user.id } });
      await tx.mfaEnrollment.deleteMany({ where: { userId: user.id } });
      return tx.user.update({ where: { id: user.id }, data: { totpSecretEncrypted: null, totpEnabledAt: null, totpLastUsedStep: null, sessionVersion: { increment: 1 } }, include: { profile: true } });
    });
    return res.json({ success: true, ...issueMobileSessionTokens(updatedUser) });
  }));

userRoutes.post('/me/email-code', authenticateRequest, requireUserAccess, securityUpdateLimiter,
  errorBoundary(async (req: AuthenticatedRequest, res) => {
    const payload = z.object({ currentPassword: z.string().min(1).max(128).optional(), newEmail: z.string().trim().toLowerCase().email() }).parse(req.body);
    const user = await prisma.user.findUnique({ where: { id: req.auth!.userId } });
    if (!user) throw new HttpError(404, 'User not found.');
    if (user.googleIdentityId) throw new HttpError(403, 'Email settings for this account are managed through Google.');
    if (!payload.currentPassword) throw new HttpError(400, 'Current password is required.');
    if (!await PasswordService.compare(payload.currentPassword, user.passwordHash)) throw new HttpError(401, 'Incorrect current password.');
    if (await prisma.user.findUnique({ where: { email: payload.newEmail } })) throw new HttpError(409, 'This email cannot be used.');
    await sendEmailChangeCode(user.id, payload.newEmail);
    return res.json({ success: true });
  }));

userRoutes.post('/me/logout-all', authenticateRequest, requireUserAccess,
  errorBoundary(async (req: AuthenticatedRequest, res) => {
    await prisma.user.update({ where: { id: req.auth!.userId }, data: { sessionVersion: { increment: 1 } } });
    return res.status(204).end();
  }));

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

    if (user.googleIdentityId) {
      throw new HttpError(403, 'Password and email settings for this account are managed through Google.');
    }
    if (!payload.currentPassword) {
      throw new HttpError(400, 'Current password is required.');
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
        if (!payload.emailCode) throw new HttpError(400, 'Verify the new email using its six-digit code.');
        const attempted = await prisma.otpCode.updateMany({
          where: { email: emailChangeKey(user.id, normalizedEmail), attempts: { lt: 5 }, expiresAt: { gt: new Date() } },
          data: { attempts: { increment: 1 } },
        });
        if (attempted.count !== 1) throw new HttpError(400, 'Email code expired or attempt limit reached. Request a new code.');
        updateData.googleIdentityId = null;
      }
    }

    if (payload.newPassword) {
      updateData.passwordHash = await PasswordService.hash(payload.newPassword);
    }

    let updatedUser = user;
    if (Object.keys(updateData).length > 0) {
      updatedUser = await prisma.$transaction(async tx => {
        if (updateData.email) {
          const key = emailChangeKey(user.id, updateData.email);
          const consumed = await tx.otpCode.deleteMany({ where: { email: key, code: emailCodeHash(key, payload.emailCode!), expiresAt: { gt: new Date() } } });
          if (consumed.count !== 1) throw new HttpError(400, 'Invalid or expired email verification code.');
        }
        return tx.user.update({
          where: { id: user.id, sessionVersion: user.sessionVersion },
          data: { ...updateData, sessionVersion: { increment: 1 } },
        });
      });
    }

    const newToken = TokenService.sign({
      userId: updatedUser.id,
      name: updatedUser.name,
      email: updatedUser.email,
      role: updatedUser.role,
      status: updatedUser.status,
      sessionVersion: updatedUser.sessionVersion,
    });

    return res.json({
      success: true,
      message: 'Security settings updated successfully.',
      token: newToken,
    });
  }),
);

export { userRoutes };
