import { Router } from 'express';
import crypto from 'crypto';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { prisma } from '../prismaClient';
import { PasswordService } from '../security/passwordService';
import { AccessRole, getRoleRedirectPath, SessionClient, TokenService } from '../security/tokenService';
import { HttpError, errorBoundary } from '../http/errorResponder';
import { resolveLiveStreak } from '../utils/gamificationUtils';
import nodemailer from 'nodemailer';
import { emailRegistrationSchema } from '../security/emailValidator';
import { LoginAttemptTracker } from '../security/loginAttemptTracker';
import { verifyGoogleIdentity } from '../security/googleIdentity';
import { emailCodeHash } from '../security/emailChange';
import { welcomeEmail } from '../services/welcomeEmail';
import { sendDirectNotification } from '../services/notificationService';
import { hashRecoveryCode, decryptTotpSecret, verifyTotp } from '../security/totp';

const transporter = nodemailer.createTransport({
  service: 'gmail',
  pool: true,
  maxConnections: 2,
  maxMessages: 100,
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_PASS,
  },
});

const authRoutes = Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
});

const otpLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many verification requests. Please try again in 10 minutes.' },
});

// OWASP ASVS: Strong password validation (at least 8 chars, 1 letter, 1 number)
const passwordComplexitySchema = z
  .string()
  .min(8, 'Password must be at least 8 characters long.')
  .max(72, 'Password must not exceed 72 characters.')
  .refine(value => Buffer.byteLength(value, 'utf8') <= 72, 'Password must be at most 72 bytes.')
  .regex(/[a-zA-Z]/, 'Password must contain at least one letter.')
  .regex(/[0-9]/, 'Password must contain at least one number.');

const registerSchema = z.object({
  email: emailRegistrationSchema,
  password: passwordComplexitySchema,
  name: z.string().min(2).max(50).optional(),
  displayName: z.string().min(2).max(50).optional(),
  city: z.string().min(1, 'Please select a barangay.'),
  otpCode: z.string().length(6),
  clientType: z.enum(['mobile', 'web']).default('mobile'),
}).refine((payload) => Boolean(payload.name ?? payload.displayName), {
  message: 'A display name is required.',
  path: ['displayName'],
});

const otpSchema = z.object({
  email: emailRegistrationSchema,
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1, 'Password is required.'),
  clientType: z.enum(['mobile', 'web']).default('mobile'),
});

const usernameAvailabilitySchema = z.object({
  displayName: z.string().trim().min(2).max(50),
});

async function requireMfaChallenge(userId: string, clientType: SessionClient) {
  const id = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 5 * 60_000);
  await prisma.mfaLoginChallenge.deleteMany({ where: { expiresAt: { lt: new Date() } } });
  await prisma.mfaLoginChallenge.create({ data: { id, userId, clientType, expiresAt } });
  return { mfaRequired: true as const, challengeToken: TokenService.signMfaChallenge({ userId, challengeId: id, clientType }), expiresAt: expiresAt.toISOString() };
}

function assertAccountNotLocked(email: string): void {
  const lockStatus = LoginAttemptTracker.isLocked(email.trim().toLowerCase());
  if (lockStatus.locked) {
    throw new HttpError(
      429,
      `Too many failed login attempts. This account is temporarily locked for security. Please try again in ${Math.ceil((lockStatus.remainingSeconds || 900) / 60)} minute(s).`,
    );
  }
}

const toAuthResponse = (user: {
  id: string;
  name: string;
  email: string;
  sessionVersion: number;
  role: AccessRole;
  status: 'active' | 'pending' | 'suspended';
  googleIdentityId: string | null;
  points: number;
  currentStreak: number;
  lastActionDate: Date | null;
  profile: { displayName: string; avatarUrl: string | null; city?: string | null } | null;
}, clientType: SessionClient = 'mobile', authTime = Math.floor(Date.now() / 1000)) => {
  const token = TokenService.sign({
    userId: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    status: user.status,
    city: user.profile?.city ?? null,
    sessionVersion: user.sessionVersion,
    clientType,
    authTime,
  });

  return {
    token,
    refreshToken: clientType === 'mobile'
      ? TokenService.signRefresh({ userId: user.id, sessionVersion: user.sessionVersion, authTime })
      : undefined,
    redirectPath: getRoleRedirectPath(user.role),
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status,
      isGoogleAccount: user.googleIdentityId != null,
      points: user.points,
      currentStreak: resolveLiveStreak(user.currentStreak, user.lastActionDate),
      displayName: user.profile?.displayName ?? user.name,
      avatarUrl: user.profile?.avatarUrl ?? null,
      city: user.profile?.city ?? null,
      profile: user.profile ? {
        displayName: user.profile.displayName,
        avatarUrl: user.profile.avatarUrl,
        city: user.profile.city ?? null,
      } : null,
    },
  };
};

const getInactiveStatusMessage = (status: 'pending' | 'suspended') =>
  status === 'suspended'
    ? 'Your ECOBUD account is suspended. Please contact an administrator.'
    : 'Your ECOBUD account is pending activation.';

const findProfileByDisplayName = (displayName: string) =>
  prisma.profile.findFirst({
    where: {
      displayName: displayName.trim(),
    },
    select: {
      id: true,
    },
  });

authRoutes.use(authLimiter);

authRoutes.get(
  '/check-username',
  errorBoundary(async (req, res) => {
    const { displayName } = usernameAvailabilitySchema.parse(req.query);
    const existingProfile = await findProfileByDisplayName(displayName);

    return res.json({
      available: !existingProfile,
      message: existingProfile
        ? 'That username is already in use.'
        : 'That username is available.',
    });
  }),
);

const emailCheckSchema = z.object({
  email: z.string().email(),
});

authRoutes.get(
  '/check-email',
  errorBoundary(async (req, res) => {
    const authorization = req.headers.authorization;
    if (!authorization?.startsWith('Bearer ')) throw new HttpError(401, 'Verified Google authentication is required.');
    const identity = await verifyGoogleIdentity(authorization.slice(7));
    const user = await prisma.user.findUnique({
      where: { email: identity.email },
      include: { profile: true },
    });

    return res.json({
      exists: Boolean(user),
      hasCity: Boolean(user?.profile?.city?.trim()),
      city: user?.profile?.city ?? null,
    });
  }),
);

authRoutes.post(
  '/register',
  errorBoundary(async (req, res) => {
    const payload = registerSchema.parse(req.body);
    assertAccountNotLocked(payload.email);
    const displayName = payload.name ?? payload.displayName!;
    const [existingUser, existingProfile] = await Promise.all([
      prisma.user.findUnique({ where: { email: payload.email } }),
      findProfileByDisplayName(displayName),
    ]);

    if (existingUser) {
      throw new HttpError(409, 'An ECOBUD account already exists for this email.');
    }

    if (existingProfile) {
      throw new HttpError(409, 'That username is already taken. Please choose another one.');
    }

    const attempt = await prisma.otpCode.updateMany({ where: { email: payload.email, attempts: { lt: 5 }, expiresAt: { gt: new Date() } }, data: { attempts: { increment: 1 } } });
    if (attempt.count !== 1) throw new HttpError(400, 'Verification code expired or attempt limit reached. Request a new code.');
    const otpRecord = await prisma.otpCode.findUnique({ where: { email: payload.email } });
    if (!otpRecord) {
      throw new HttpError(400, 'No verification code requested for this email.');
    }

    if (otpRecord.code !== emailCodeHash(payload.email, payload.otpCode)) {
      throw new HttpError(400, 'Invalid verification code.');
    }

    if (new Date() > otpRecord.expiresAt) {
      throw new HttpError(400, 'Verification code expired. Please request a new one.');
    }

    // Clean up used OTP
    const consumed = await prisma.otpCode.deleteMany({ where: { email: payload.email, code: otpRecord.code, expiresAt: { gt: new Date() } } });
    if (consumed.count !== 1) throw new HttpError(400, 'Verification code already used.');

    const passwordHash = await PasswordService.hash(payload.password);
    const user = await prisma.user.create({
      data: {
        name: displayName,
        email: payload.email,
        passwordHash,
        role: 'user',
        status: 'active',
        verifiedAt: new Date(),
        stats: {
          create: {
            currentStreak: 0,
            ecoPoints: 0,
            ecoCoins: 0,
            knowledgePoints: 0,
          },
        },
        weeklyGoal: {
          create: {
            weeklyGoal: 5,
          },
        },
        profile: {
          create: {
            displayName,
            city: payload.city,
            headline: 'Growing sustainable habits every day.',
          },
        },
      },
      include: {
        profile: true,
      },
    });

    // Fire-and-forget: welcome in-app + push notification
    void sendDirectNotification({
      userId: user.id,
      type: 'system',
      title: 'Welcome to EcoBud! 🌿',
      message: "You're now part of a growing community making real environmental impact. Complete challenges, join Eco Events, and earn EXP & Eco-Coins while building greener habits. Let's grow together! 🌱",
      priority: 'high',
      notificationKey: `welcome:${user.id}`,
    }).catch(() => {});

    // Fire-and-forget: welcome email
    if (process.env.GMAIL_USER && process.env.GMAIL_PASS) {
      transporter.sendMail({
        from: `"ECOBUD" <${process.env.GMAIL_USER}>`,
        to: user.email,
        ...welcomeEmail(process.env.ECOBUD_WELCOME_URL || 'ecobud://'),
      }).catch((err) => {
        console.error('Failed to send welcome email to new user:', err?.message || err);
      });
    }

    return res.status(201).json(toAuthResponse(user, payload.clientType));
  }),
);

authRoutes.post(
  '/send-otp',
  otpLimiter,
  errorBoundary(async (req, res) => {
    const { email } = otpSchema.parse(req.body);
    assertAccountNotLocked(email);
    const existingUser = await prisma.user.findUnique({ where: { email } });

    if (existingUser) {
      return res.json({ success: true, message: 'If this email can be registered, a verification code has been sent.' });
    }

    const code = crypto.randomInt(100000, 1000000).toString();
    const storedCode = emailCodeHash(email, code);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    await prisma.otpCode.upsert({
      where: { email },
      update: { code: storedCode, expiresAt, attempts: 0 },
      create: { email, code: storedCode, expiresAt },
    });

    try {
      await transporter.sendMail({
        // Gmail only permits sending from the authenticated address unless an alias
        // has been configured in that Gmail account.
        from: `"ECOBUD Auth" <${process.env.GMAIL_USER}>`,
        to: email,
        subject: 'Your ECOBUD Verification Code',
        text: `Your ECOBUD verification code is: ${code}. It expires in 10 minutes.`,
        html: `
          <div style="margin:0;padding:32px 16px;background:#f3f8f4;font-family:Arial,Helvetica,sans-serif;color:#173b2b;">
            <div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 8px 24px rgba(23,59,43,.12);">
              <div style="padding:30px 24px 24px;background:#1f6f4a;text-align:center;color:#ffffff;">
                <div style="width:72px;height:72px;margin:0 auto 14px;border-radius:50%;background:#d9f2df;color:#1f6f4a;font-size:38px;line-height:72px;">🌿</div>
                <div style="font-size:24px;font-weight:700;letter-spacing:.4px;">ECOBUD</div>
                <div style="margin-top:6px;font-size:14px;opacity:.9;">Account verification</div>
              </div>
              <div style="padding:32px 28px;text-align:center;">
                <h1 style="margin:0 0 12px;font-size:24px;color:#173b2b;">Verify your email</h1>
                <p style="margin:0 0 24px;font-size:16px;line-height:1.5;color:#4d6358;">Use this code to finish creating your ECOBUD account.</p>
                <div style="margin:0 auto 24px;padding:18px 12px;border:1px dashed #71a786;border-radius:12px;background:#f2faf4;color:#1f6f4a;font-size:32px;font-weight:700;letter-spacing:8px;">${code}</div>
                <p style="margin:0;font-size:14px;line-height:1.5;color:#718278;">This code expires in <strong>10 minutes</strong>. Do not share it with anyone.</p>
              </div>
              <div style="padding:18px 24px;background:#f7faf8;text-align:center;font-size:12px;color:#718278;">If you did not request this code, you can safely ignore this email.</div>
            </div>
          </div>
        `,
      });
    } catch (e) {
      console.error('OTP email delivery failed.');
      await prisma.otpCode.deleteMany({ where: { email, code: storedCode } });
      throw new HttpError(503, 'Verification email could not be sent. Please try again later.');
    }

    return res.json({ success: true, message: 'If this email can be registered, a verification code has been sent.' });
  }),
);

authRoutes.post(
  '/login',
  errorBoundary(async (req, res) => {
    const payload = loginSchema.parse(req.body);
    const normalizedEmail = payload.email.trim().toLowerCase();

    // Check account-level lockout
    const lockStatus = LoginAttemptTracker.isLocked(normalizedEmail);
    if (lockStatus.locked) {
      throw new HttpError(
        429,
        `Too many failed login attempts. This account is temporarily locked for security. Please try again in ${Math.ceil((lockStatus.remainingSeconds || 900) / 60)} minute(s).`,
      );
    }

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      include: { profile: true },
    });

    if (!user) {
      LoginAttemptTracker.recordFailure(normalizedEmail);
      throw new HttpError(401, 'Incorrect email or password.');
    }

    const passwordMatches = await PasswordService.compare(payload.password, user.passwordHash);

    if (!passwordMatches) {
      const failureResult = LoginAttemptTracker.recordFailure(normalizedEmail);
      if (failureResult.locked) {
        throw new HttpError(
          429,
          `Too many failed login attempts. Your account has been temporarily locked for 15 minutes.`,
        );
      }
      throw new HttpError(401, 'Incorrect email or password.');
    }

    if (user.status !== 'active') {
      throw new HttpError(403, getInactiveStatusMessage(user.status));
    }

    if (user.totpEnabledAt) {
      if (!user.totpSecretEncrypted) throw new HttpError(503, 'Authenticator verification is unavailable. Contact support before signing in.');
      return res.json(await requireMfaChallenge(user.id, payload.clientType));
    }

    // Reset failed attempts upon successful login
    LoginAttemptTracker.recordSuccess(normalizedEmail);

    return res.json(toAuthResponse(user, payload.clientType));
  }),
);

const mfaVerifySchema = z.object({ challengeToken: z.string().min(1).max(4096), code: z.string().trim().min(1).max(32) });
authRoutes.post('/mfa/verify', otpLimiter, errorBoundary(async (req, res) => {
  const payload = mfaVerifySchema.parse(req.body);
  let challengeClaims;
  try {
    challengeClaims = TokenService.verifyMfaChallenge(payload.challengeToken);
  } catch {
    throw new HttpError(401, 'This sign-in verification expired. Please sign in again.');
  }

  const challenge = await prisma.mfaLoginChallenge.findUnique({
    where: { id: challengeClaims.challengeId },
    include: { user: { include: { profile: true } } },
  });
  if (!challenge || challenge.userId !== challengeClaims.userId || challenge.consumedAt || challenge.expiresAt <= new Date()) {
    throw new HttpError(401, 'This sign-in verification expired. Please sign in again.');
  }
  const user = challenge.user;
  assertAccountNotLocked(user.email);
  if (user.status !== 'active' || !user.totpEnabledAt || !user.totpSecretEncrypted) {
    throw new HttpError(401, 'Authenticator verification could not be completed. Please sign in again.');
  }

  const normalizedCode = payload.code.replace(/[\s-]/g, '').toUpperCase();
  const secret = decryptTotpSecret(user.totpSecretEncrypted);
  const step = verifyTotp(secret, normalizedCode);
  if (step !== null) {
    await prisma.$transaction(async (tx) => {
      const reserved = await tx.user.updateMany({
        where: { id: user.id, OR: [{ totpLastUsedStep: null }, { totpLastUsedStep: { lt: BigInt(step) } }] },
        data: { totpLastUsedStep: BigInt(step) },
      });
      if (reserved.count !== 1) throw new HttpError(401, 'That authenticator code has already been used. Try the next code.');
      const consumed = await tx.mfaLoginChallenge.updateMany({ where: { id: challenge.id, consumedAt: null, expiresAt: { gt: new Date() } }, data: { consumedAt: new Date() } });
      if (consumed.count !== 1) throw new HttpError(401, 'This sign-in verification expired. Please sign in again.');
    });
  } else {
    const recoveryRows = await prisma.mfaRecoveryCode.findMany({ where: { userId: user.id, usedAt: null } });
    const matching = recoveryRows.find((row) => {
      const expected = Buffer.from(row.codeHash, 'hex');
      const actual = Buffer.from(hashRecoveryCode(normalizedCode), 'hex');
      return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
    });
    if (!matching) {
      LoginAttemptTracker.recordFailure(user.email);
      throw new HttpError(401, 'The authenticator code or recovery code is invalid.');
    }
    await prisma.$transaction(async (tx) => {
      const consumedRecovery = await tx.mfaRecoveryCode.updateMany({ where: { id: matching.id, usedAt: null }, data: { usedAt: new Date() } });
      if (consumedRecovery.count !== 1) throw new HttpError(401, 'That recovery code has already been used.');
      const consumed = await tx.mfaLoginChallenge.updateMany({ where: { id: challenge.id, consumedAt: null, expiresAt: { gt: new Date() } }, data: { consumedAt: new Date() } });
      if (consumed.count !== 1) throw new HttpError(401, 'This sign-in verification expired. Please sign in again.');
    });
  }

  LoginAttemptTracker.recordSuccess(user.email);
  return res.json(toAuthResponse(user, challengeClaims.clientType));
}));

const googleAuthSchema = z.object({
  accessToken: z.string().min(1).max(16384),
  city: z.string().trim().min(1).max(80).optional(),
  clientType: z.enum(['mobile', 'web']).default('mobile'),
});

authRoutes.post(
  '/google',
  errorBoundary(async (req, res) => {
    const payload = googleAuthSchema.parse(req.body);
    const identity = await verifyGoogleIdentity(payload.accessToken);
    const normalizedEmail = identity.email;
    assertAccountNotLocked(normalizedEmail);
    const displayName = identity.name;

    let user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      include: { profile: true },
    });

    if (!user) {
      // Find a non-conflicting display name
      let uniqueDisplayName = displayName;
      let counter = 1;
      while (await prisma.profile.findFirst({ where: { displayName: uniqueDisplayName } })) {
        uniqueDisplayName = `${displayName}${counter++}`;
      }

      const randomPasswordHash = await PasswordService.hash(crypto.randomBytes(32).toString('hex'));

      user = await prisma.user.create({
        data: {
          email: normalizedEmail,
          googleIdentityId: identity.id,
          passwordHash: randomPasswordHash,
          name: uniqueDisplayName,
          role: 'user',
          status: 'active',
          verifiedAt: new Date(),
          stats: {
            create: {
              currentStreak: 0,
              ecoPoints: 0,
              ecoCoins: 0,
              knowledgePoints: 0,
            },
          },
          weeklyGoal: {
            create: {
              weeklyGoal: 5,
            },
          },
          profile: {
            create: {
              displayName: uniqueDisplayName,
              avatarUrl: identity.avatarUrl,
              city: payload.city?.trim() || 'Brgy. Poblacion',
              headline: 'Growing sustainable habits with EcoBud.',
            },
          },
        },
        include: {
          profile: true,
        },
      });

      // Directly dispatch welcome email to the newly registered Google user
      if (process.env.GMAIL_USER && process.env.GMAIL_PASS) {
        transporter.sendMail({
          from: `"ECOBUD" <${process.env.GMAIL_USER}>`,
          to: normalizedEmail,
          ...welcomeEmail(process.env.ECOBUD_WELCOME_URL || 'ecobud://'),
        }).catch((err) => {
          console.error('Failed to send welcome email to new Google user:', err?.message || err);
        });
      }

      // Fire-and-forget: welcome in-app + push notification for Google sign-in
      void sendDirectNotification({
        userId: user.id,
        type: 'system',
        title: 'Welcome to EcoBud! 🌿',
        message: "You're now part of a growing community making real environmental impact. Complete challenges, join Eco Events, and earn EXP & Eco-Coins while building greener habits. Let's grow together! 🌱",
        priority: 'high',
        notificationKey: `welcome:${user.id}`,
      }).catch(() => {});
    } else {
      if (user.role !== 'user' || (user.googleIdentityId && user.googleIdentityId !== identity.id) ||
          (!user.googleIdentityId && !identity.canLinkByEmail)) {
        throw new HttpError(403, 'Use your password to sign in to this account.');
      }
      if (user.status !== 'active') {
        throw new HttpError(403, getInactiveStatusMessage(user.status));
      }
      if (!user.googleIdentityId) {
        user = await prisma.user.update({ where: { id: user.id }, data: { googleIdentityId: identity.id }, include: { profile: true } });
      }
      // For existing accounts, do not overwrite their displayName or avatarUrl,
      // so their avatar continues to use their custom username / initial (e.g. 'L' for 'Lanczu2').
    }

    if (!user) {
      throw new HttpError(500, 'Failed to authenticate user.');
    }

    if (user.totpEnabledAt) {
      if (!user.totpSecretEncrypted) throw new HttpError(503, 'Authenticator verification is unavailable. Contact support before signing in.');
      return res.json(await requireMfaChallenge(user.id, payload.clientType));
    }
    return res.json(toAuthResponse(user, payload.clientType));
  }),
);

authRoutes.post(
  '/refresh',
  authLimiter,
  errorBoundary(async (req, res) => {
    const { refreshToken } = z.object({ refreshToken: z.string().min(1).max(16384) }).parse(req.body);
    let refreshSession;
    try {
      refreshSession = TokenService.verifyRefresh(refreshToken);
    } catch {
      throw new HttpError(401, 'Your mobile session has expired. Please sign in again.');
    }
    const user = await prisma.user.findUnique({
      where: { id: refreshSession.userId },
      include: { profile: true },
    });

    if (!user || user.status !== 'active' || user.sessionVersion !== refreshSession.sessionVersion) {
      throw new HttpError(401, 'Your mobile session is no longer valid. Please sign in again.');
    }

    return res.json(toAuthResponse(user, 'mobile', refreshSession.authTime));
  }),
);

authRoutes.post(
  '/logout',
  authLimiter,
  errorBoundary(async (req, res) => {
    const { refreshToken } = z.object({ refreshToken: z.string().min(1).max(16384) }).parse(req.body);
    let refreshSession;
    try {
      refreshSession = TokenService.verifyRefresh(refreshToken);
    } catch {
      return res.status(204).end();
    }

    // Refresh JWTs are stateless, so invalidate the account's current sessions.
    await prisma.user.updateMany({
      where: { id: refreshSession.userId, sessionVersion: refreshSession.sessionVersion },
      data: { sessionVersion: { increment: 1 } },
    });
    return res.status(204).end();
  }),
);

export { authRoutes };
