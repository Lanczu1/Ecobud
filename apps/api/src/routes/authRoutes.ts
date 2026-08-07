import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { prisma } from '../prismaClient';
import { PasswordService } from '../security/passwordService';
import { AccessRole, getRoleRedirectPath, TokenService } from '../security/tokenService';
import { HttpError, errorBoundary } from '../http/errorResponder';
import { resolveLiveStreak } from '../utils/gamificationUtils';
import nodemailer from 'nodemailer';

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
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
});

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(2).max(50).optional(),
  displayName: z.string().min(2).max(50).optional(),
  otpCode: z.string().length(6),
}).refine((payload) => Boolean(payload.name ?? payload.displayName), {
  message: 'A display name is required.',
  path: ['displayName'],
});

const otpSchema = z.object({
  email: z.string().email(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
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
  errorBoundary(async (req, res) => {
    const { email } = otpSchema.parse(req.body);
    const existingUser = await prisma.user.findUnique({ where: { email } });

    if (existingUser) {
      throw new HttpError(409, 'An ECOBUD account already exists for this email.');
    }

    const code = Math.floor(100000 + Math.random() * 900000).toString();
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
    const user = await prisma.user.findUnique({
      where: { email: payload.email },
      include: { profile: true },
    });

    if (!user) {
      throw new HttpError(401, 'Incorrect email or password.');
    }

    const passwordMatches = await PasswordService.compare(payload.password, user.passwordHash);

    if (!passwordMatches) {
      throw new HttpError(401, 'Incorrect email or password.');
    }

    if (user.status !== 'active') {
      throw new HttpError(403, getInactiveStatusMessage(user.status));
    }

    return res.json(toAuthResponse(user));
  }),
);

export { authRoutes };
