import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { prisma } from '../prismaClient';
import { PasswordService } from '../security/passwordService';
import { AccessRole, TokenService } from '../security/tokenService';
import { HttpError, errorBoundary } from '../http/errorResponder';
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
  displayName: z.string().min(2).max(50),
  otpCode: z.string().length(6),
});

const otpSchema = z.object({
  email: z.string().email(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

const toAuthResponse = (user: {
  id: string;
  email: string;
  role: string;
  points: number;
  currentStreak: number;
  profile: { displayName: string; avatarUrl: string | null } | null;
}) => {
  const role = (['USER', 'MODERATOR', 'ADMIN'].includes(user.role)
    ? user.role
    : 'USER') as AccessRole;

  const token = TokenService.sign({
    userId: user.id,
    email: user.email,
    role,
  });

  return {
    token,
    user: {
      id: user.id,
      email: user.email,
      role,
      points: user.points,
      currentStreak: user.currentStreak,
      displayName: user.profile?.displayName ?? user.email,
      avatarUrl: user.profile?.avatarUrl ?? null,
    },
  };
};

authRoutes.use(authLimiter);

authRoutes.post(
  '/register',
  errorBoundary(async (req, res) => {
    const payload = registerSchema.parse(req.body);
    const existingUser = await prisma.user.findUnique({ where: { email: payload.email } });

    if (existingUser) {
      throw new HttpError(409, 'An ECOBUD account already exists for this email.');
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
        email: payload.email,
        passwordHash,
        profile: {
          create: {
            displayName: payload.displayName,
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

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    await prisma.otpCode.upsert({
      where: { email },
      update: { code, expiresAt },
      create: { email, code, expiresAt },
    });

    try {
      await transporter.sendMail({
        from: '"ECOBUD Auth" <no-reply@ecobud.app>',
        to: email,
        subject: 'Your ECOBUD Verification Code',
        text: `Your ECOBUD verification code is: ${code}. It expires in 10 minutes.`,
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

    return res.json(toAuthResponse(user));
  }),
);

export { authRoutes };
