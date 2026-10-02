import { Router } from 'express';
import { randomInt, randomUUID, timingSafeEqual } from 'crypto';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import nodemailer from 'nodemailer';
import { z } from 'zod';
import { prisma } from '../prismaClient';
import { errorBoundary, HttpError } from '../http/errorResponder';
import { emailCodeHash } from '../security/emailChange';
import { JWT_SECRET } from '../security/tokenService';
import { PasswordService } from '../security/passwordService';
import { SignupOtpSendLimiter } from '../security/signupOtpSendLimiter';

export const passwordResetRoutes = Router();
const requestTrafficLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many reset requests. Please try again shortly.' },
});
const requestLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  requestWasSuccessful: (_req, res) => res.locals.resetCodeReused === true,
  handler: (_req, res) => {
    const seconds = Math.max(1, Number(res.getHeader('Retry-After')) || 900);
    return res.status(429).json({ message: `Too many reset requests from this network. Please try again in ${Math.ceil(seconds / 60)} minute(s).` });
  },
});
const verifyLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: true, legacyHeaders: false,
  message: { message: 'Too many reset verification attempts. Please try again in 15 minutes.' } });
const emailLimiter = new SignupOtpSendLimiter();
const emailSchema = z.string().trim().toLowerCase().email().max(254);
const requestSchema = z.object({ email: emailSchema });
const verifySchema = requestSchema.extend({ code: z.string().regex(/^\d{6}$/) });
const completeSchema = z.object({ resetToken: z.string().min(1).max(4096),
  password: z.string().min(8).max(72).refine((value) => Buffer.byteLength(value, 'utf8') <= 72)
    .regex(/[a-zA-Z]/).regex(/[0-9]/),
});
const resetClaims = z.object({ userId: z.string().min(1), email: emailSchema, sessionVersion: z.number().int().nonnegative(),
  grantId: z.string().uuid(), tokenUse: z.literal('password-reset') });
const genericMessage = 'If this email has a password account, we will send a reset code. If you use Google, continue with Google on the login screen.';
const invalidCode = () => new HttpError(400, 'The reset code is invalid, expired, or has reached its attempt limit.');
const invalidGrant = () => new HttpError(400, 'This password reset expired or was already used. Request a new code.');
const codeKey = (email: string) => `reset-code:${email}`;
const grantKey = (id: string) => `reset-grant:${id}`;
const eligible = (user: { status: string; role: string; googleIdentityId: string | null } | null) =>
  Boolean(user && user.status === 'active' && user.role === 'user' && !user.googleIdentityId);
const codeHash = (key: string, user: { id: string; sessionVersion: number }, code: string) =>
  emailCodeHash(key, `${user.id}:${user.sessionVersion}:${code}`);
const grantHash = (claims: z.infer<typeof resetClaims>) =>
  emailCodeHash(grantKey(claims.grantId), `${claims.userId}:${claims.email}:${claims.sessionVersion}`);
const mailer = nodemailer.createTransport({ service: 'gmail', pool: true, maxConnections: 2,
  auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_PASS } });

passwordResetRoutes.post('/request-code', requestTrafficLimiter, requestLimiter, errorBoundary(async (req, res) => {
  const { email } = requestSchema.parse(req.body);
  const user = await prisma.user.findUnique({ where: { email } });
  if (user?.googleIdentityId) {
    throw new HttpError(403, 'This account uses Google sign-in. Please use Continue with Google.');
  }
  const key = codeKey(email);
  const now = new Date(Date.now());
  const reply = (expiresAt: Date) => res.json({ success: true, message: genericMessage,
    expiresAt: expiresAt.toISOString(), serverTime: new Date(Date.now()).toISOString() });
  const existing = await prisma.otpCode.findUnique({ where: { email: key } });
  if (existing && existing.expiresAt > now) {
    res.locals.resetCodeReused = true;
    return reply(existing.expiresAt);
  }
  const retryAfter = emailLimiter.retryAfterSeconds(email);
  if (retryAfter) {
    res.setHeader('Retry-After', retryAfter);
    throw new HttpError(429, 'Too many reset requests for this email. Please wait before requesting another code.');
  }
  const code = randomInt(100000, 1000000).toString();
  const storedHash = codeHash(key, user ?? { id: randomUUID(), sessionVersion: 0 }, code);
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
  const replaced = await prisma.otpCode.updateMany({ where: { email: key, expiresAt: { lte: now } },
    data: { code: storedHash, expiresAt, attempts: 0 } });
  if (!replaced.count) {
    try {
      await prisma.otpCode.create({ data: { email: key, code: storedHash, expiresAt, attempts: 0 } });
    } catch (error) {
      if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002') {
        const reserved = await prisma.otpCode.findUnique({ where: { email: key } });
        res.locals.resetCodeReused = true;
        return reply(reserved?.expiresAt ?? expiresAt);
      }
      throw error;
    }
  }
  emailLimiter.recordSend(email);
  if (user && eligible(user)) {
    try {
      void mailer.sendMail({ from: process.env.GMAIL_USER, to: email, subject: 'Reset your ECOBUD password',
        text: `Your password reset code is ${code}. It expires in 5 minutes. Do not share this code. If you did not request a password reset, ignore this email.` }).catch(() => { console.error('Password reset email delivery failed.'); });
    } catch {
      console.error('Password reset email delivery failed.');
    }
  }
  return reply(expiresAt);
}));

passwordResetRoutes.post('/verify-code', verifyLimiter, errorBoundary(async (req, res) => {
  const { email, code } = verifySchema.parse(req.body);
  const key = codeKey(email);
  const attempted = await prisma.otpCode.updateMany({ where: { email: key, attempts: { lt: 5 }, expiresAt: { gt: new Date() } },
    data: { attempts: { increment: 1 } } });
  if (attempted.count !== 1) throw invalidCode();
  const [record, user] = await Promise.all([
    prisma.otpCode.findUnique({ where: { email: key } }),
    prisma.user.findUnique({ where: { email } }),
  ]);
  if (!record || !user || !eligible(user)) throw invalidCode();
  const expected = Buffer.from(codeHash(key, user, code), 'hex');
  const actual = Buffer.from(record.code, 'hex');
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) throw invalidCode();
  const claims = { userId: user.id, email, sessionVersion: user.sessionVersion, grantId: randomUUID(), tokenUse: 'password-reset' as const };
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
  await prisma.$transaction(async (tx) => {
    const consumed = await tx.otpCode.deleteMany({ where: { email: key, code: record.code, expiresAt: { gt: new Date() }, attempts: { lte: 5 } } });
    if (consumed.count !== 1) throw invalidCode();
    await tx.otpCode.create({ data: { email: grantKey(claims.grantId), code: grantHash(claims), expiresAt } });
  });
  const resetToken = jwt.sign({ ...claims, exp: Math.floor(expiresAt.getTime() / 1000) }, JWT_SECRET,
    { algorithm: 'HS256', issuer: 'ecobud-api', audience: 'ecobud-password-reset' });
  return res.json({ resetToken, expiresAt: expiresAt.toISOString(), serverTime: new Date(Date.now()).toISOString() });
}));

passwordResetRoutes.post('/complete', verifyLimiter, errorBoundary(async (req, res) => {
  const payload = completeSchema.parse(req.body);
  let claims: z.infer<typeof resetClaims>;
  try {
    claims = resetClaims.parse(jwt.verify(payload.resetToken, JWT_SECRET,
      { algorithms: ['HS256'], issuer: 'ecobud-api', audience: 'ecobud-password-reset' }));
  } catch { throw invalidGrant(); }
  const user = await prisma.user.findUnique({ where: { id: claims.userId } });
  if (!user || !eligible(user) || user.email !== claims.email || user.sessionVersion !== claims.sessionVersion) throw invalidGrant();
  const passwordHash = await PasswordService.hash(payload.password);
  await prisma.$transaction(async (tx) => {
    const consumed = await tx.otpCode.deleteMany({ where: { email: grantKey(claims.grantId), code: grantHash(claims), expiresAt: { gt: new Date() } } });
    if (consumed.count !== 1) throw invalidGrant();
    const updated = await tx.user.updateMany({
      where: { id: claims.userId, email: claims.email, sessionVersion: claims.sessionVersion, status: 'active', role: 'user', googleIdentityId: null },
      data: { passwordHash, sessionVersion: { increment: 1 } },
    });
    if (updated.count !== 1) throw invalidGrant();
  });
  return res.json({ success: true, message: 'Password updated. Sign in with your new password.' });
}));
