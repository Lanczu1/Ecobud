import { Router } from 'express';
import crypto from 'crypto';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { prisma } from '../prismaClient';
import { PasswordService } from '../security/passwordService';
import { AccessRole, getRoleRedirectPath, TokenService } from '../security/tokenService';
import { HttpError, errorBoundary } from '../http/errorResponder';
import { resolveLiveStreak } from '../utils/gamificationUtils';
import nodemailer from 'nodemailer';
import { emailRegistrationSchema } from '../security/emailValidator';
import { LoginAttemptTracker } from '../security/loginAttemptTracker';

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER || 'demo@gmail.com',
    pass: process.env.GMAIL_PASS || 'demo1234',
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
  .max(128, 'Password must not exceed 128 characters.')
  .regex(/[a-zA-Z]/, 'Password must contain at least one letter.')
  .regex(/[0-9]/, 'Password must contain at least one number.');

const registerSchema = z.object({
  email: emailRegistrationSchema,
  password: passwordComplexitySchema,
  name: z.string().min(2).max(50).optional(),
  displayName: z.string().min(2).max(50).optional(),
  city: z.string().min(1, 'Please select a barangay.'),
  otpCode: z.string().length(6),
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
});

const usernameAvailabilitySchema = z.object({
  displayName: z.string().trim().min(2).max(50),
});

const toAuthResponse = (user: {
  id: string;
  name: string;
  email: string;
  role: AccessRole;
  status: 'active' | 'pending' | 'suspended';
  points: number;
  currentStreak: number;
  lastActionDate: Date | null;
  profile: { displayName: string; avatarUrl: string | null } | null;
}) => {
  const token = TokenService.sign({
    userId: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    status: user.status,
  });

  return {
    token,
    redirectPath: getRoleRedirectPath(user.role),
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status,
      points: user.points,
      currentStreak: resolveLiveStreak(user.currentStreak, user.lastActionDate),
      displayName: user.profile?.displayName ?? user.name,
      avatarUrl: user.profile?.avatarUrl ?? null,
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
    const { email } = emailCheckSchema.parse(req.query);
    const normalizedEmail = email.trim().toLowerCase();
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
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
    const displayName = payload.name ?? payload.displayName!;
    const existingUser = await prisma.user.findUnique({ where: { email: payload.email } });
    const existingProfile = await findProfileByDisplayName(displayName);

    if (existingUser) {
      throw new HttpError(409, 'An ECOBUD account already exists for this email.');
    }

    if (existingProfile) {
      throw new HttpError(409, 'That username is already taken. Please choose another one.');
    }

    const otpRecord = await prisma.otpCode.findUnique({ where: { email: payload.email } });
    if (!otpRecord) {
      throw new HttpError(400, 'No verification code requested for this email.');
    }

    if (otpRecord.code !== payload.otpCode) {
      throw new HttpError(400, 'Invalid verification code.');
    }

    if (new Date() > otpRecord.expiresAt) {
      throw new HttpError(400, 'Verification code expired. Please request a new one.');
    }

    // Clean up used OTP
    await prisma.otpCode.delete({ where: { email: payload.email } });

    const passwordHash = await PasswordService.hash(payload.password);
    const user = await prisma.user.create({
      data: {
        name: displayName,
        email: payload.email,
        passwordHash,
        role: 'user',
        status: 'active',
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

    return res.status(201).json(toAuthResponse(user));
  }),
);

authRoutes.post(
  '/send-otp',
  otpLimiter,
  errorBoundary(async (req, res) => {
    const { email } = otpSchema.parse(req.body);
    const existingUser = await prisma.user.findUnique({ where: { email } });

    if (existingUser) {
      throw new HttpError(409, 'An ECOBUD account already exists for this email.');
    }

    const code = crypto.randomInt(100000, 1000000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    await prisma.otpCode.upsert({
      where: { email },
      update: { code, expiresAt },
      create: { email, code, expiresAt },
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
      console.error('Failed to send OTP email', e);
      // Even if mock email fails, we return success for demo purporses if no valid credentials
    }

    return res.json({ success: true, message: 'OTP sent successfully.' });
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
      where: { email: payload.email },
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

    // Reset failed attempts upon successful login
    LoginAttemptTracker.recordSuccess(normalizedEmail);

    return res.json(toAuthResponse(user));
  }),
);

const googleAuthSchema = z.object({
  idToken: z.string().min(1).optional(),
  email: z.string().email(),
  displayName: z.string().optional(),
  avatarUrl: z.string().optional(),
  city: z.string().optional(),
});

authRoutes.post(
  '/google',
  errorBoundary(async (req, res) => {
    const payload = googleAuthSchema.parse(req.body);
    const normalizedEmail = payload.email.trim().toLowerCase();
    const displayName = payload.displayName?.trim() || normalizedEmail.split('@')[0] || 'EcoBud User';

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
          passwordHash: randomPasswordHash,
          name: uniqueDisplayName,
          role: 'user',
          status: 'active',
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
              avatarUrl: payload.avatarUrl || null,
              city: payload.city?.trim() || 'Brgy. Poblacion',
              headline: 'Growing sustainable habits with EcoBud.',
            },
          },
        },
        include: {
          profile: true,
        },
      });
    } else {
      if (user.status !== 'active') {
        throw new HttpError(403, getInactiveStatusMessage(user.status));
      }
      // For existing accounts, do not overwrite their displayName or avatarUrl,
      // so their avatar continues to use their custom username / initial (e.g. 'L' for 'Lanczu2').
    }

    if (!user) {
      throw new HttpError(500, 'Failed to authenticate user.');
    }

    return res.json(toAuthResponse(user));
  }),
);

export { authRoutes };

