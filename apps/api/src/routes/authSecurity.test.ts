import { beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
const { db, google, compare, sendMail } = vi.hoisted(() => ({
  db: { user: { findUnique: vi.fn(), update: vi.fn(), create: vi.fn() }, profile: { findFirst: vi.fn(), upsert: vi.fn() }, otpCode: { create: vi.fn(), findUnique: vi.fn(), upsert: vi.fn(), updateMany: vi.fn(), deleteMany: vi.fn() }, $transaction: vi.fn() },
  google: vi.fn(), compare: vi.fn(), sendMail: vi.fn(),
}));
vi.mock('../prismaClient', () => ({ prisma: db }));
vi.mock('../security/googleIdentity', () => ({ verifyGoogleIdentity: google }));
vi.mock('../security/passwordService', () => ({ PasswordService: { compare, hash: vi.fn(async () => 'new-hash') } }));
vi.mock('nodemailer', () => ({ default: { createTransport: () => ({ sendMail }) } }));
vi.mock('../services/supabaseStorageService', () => ({ supabaseStorageService: {} }));
vi.mock('express-rate-limit', () => ({ default: () => (_req: unknown, _res: unknown, next: (error?: unknown) => void) => next() }));
import { authRoutes } from './authRoutes';
import { userRoutes } from './userRoutes';
import { errorResponder } from '../http/errorResponder';
import { TokenService, JWT_SECRET } from '../security/tokenService';
import { authenticateRequest } from '../http/authentication';
const app = express();
app.use(express.json());
app.use('/auth', authRoutes);
app.use('/users', userRoutes);
app.get('/private', authenticateRequest, (_req, res) => res.json({ ok: true }));
app.use(errorResponder);
const user = { id: 'alice', name: 'Alice', email: 'alice@gmail.com', role: 'user' as const, status: 'active' as const, sessionVersion: 0, passwordHash: 'hash', profile: null, points: 0, currentStreak: 0, lastActionDate: null };
const token = () => TokenService.sign({ ...user, userId: user.id });
beforeEach(() => {
  vi.clearAllMocks();
  db.otpCode.findUnique.mockReset().mockResolvedValue(null);
  db.otpCode.create.mockReset().mockResolvedValue({});
  db.otpCode.updateMany.mockReset().mockResolvedValue({ count: 0 });
  sendMail.mockReset().mockResolvedValue({ messageId: 'mock' });
  db.user.findUnique.mockResolvedValue({ ...user });
  db.user.update.mockResolvedValue({ ...user, sessionVersion: 1 });
  db.$transaction.mockImplementation(async (fn) => fn(db));
  compare.mockResolvedValue(true);
  google.mockResolvedValue({ id: 'google-alice', email: user.email, name: user.name, canLinkByEmail: true });
});
describe('authentication security regressions', () => {
  it.each([0, 5])('preserves an active code with %s attempts without sending again', async (attempts) => {
    db.user.findUnique.mockResolvedValue(null);
    db.otpCode.findUnique.mockResolvedValue({ code: 'unchanged', attempts, expiresAt: new Date(Date.now() + 120000) });
    const response = await request(app).post('/auth/send-otp').send({ email: ' Active@Gmail.COM ' }).expect(429);
    expect(Number(response.headers['retry-after'])).toBeGreaterThan(0);
    expect(sendMail).not.toHaveBeenCalled();
    expect(db.otpCode.create).not.toHaveBeenCalled();
    expect(db.otpCode.updateMany).not.toHaveBeenCalled();
    expect(db.otpCode.deleteMany).not.toHaveBeenCalled();
  });
  it('replaces only an expired OTP and resets its attempts', async () => {
    db.user.findUnique.mockResolvedValue(null);
    db.otpCode.findUnique.mockResolvedValue({ expiresAt: new Date(Date.now() - 1), attempts: 5 });
    db.otpCode.updateMany.mockResolvedValue({ count: 1 });
    await request(app).post('/auth/send-otp').send({ email: 'expired@gmail.com' }).expect(200);
    expect(db.otpCode.updateMany).toHaveBeenCalledWith({
      where: { email: 'expired@gmail.com', expiresAt: { lte: expect.any(Date) } },
      data: expect.objectContaining({ attempts: 0 }),
    });
    expect(db.otpCode.create).not.toHaveBeenCalled();
    expect(sendMail).toHaveBeenCalledOnce();
  });
  it('sends exactly one email for concurrent duplicate requests', async () => {
    db.user.findUnique.mockResolvedValue(null);
    let saved: { expiresAt: Date } | null = null;
    db.otpCode.findUnique.mockImplementation(async () => saved);
    db.otpCode.create.mockImplementation(async ({ data }) => {
      if (saved) throw { code: 'P2002' };
      saved = data;
      return data;
    });
    const responses = await Promise.all([
      request(app).post('/auth/send-otp').send({ email: 'concurrent@gmail.com' }),
      request(app).post('/auth/send-otp').send({ email: 'concurrent@gmail.com' }),
    ]);
    expect(responses.map((response) => response.status).sort()).toEqual([200, 429]);
    expect(sendMail).toHaveBeenCalledOnce();
    expect(db.otpCode.deleteMany).not.toHaveBeenCalled();
  });
  it('limits retries even when SMTP failures remove the pending code', async () => {
    db.user.findUnique.mockResolvedValue(null);
    sendMail.mockRejectedValue(new Error('Delivery failed'));
    for (let attempt = 0; attempt < 3; attempt++) {
      await request(app).post('/auth/send-otp').send({ email: 'delivery.limit@gmail.com' }).expect(503);
    }
    await request(app).post('/auth/send-otp').send({ email: ' DELIVERY.LIMIT@GMAIL.COM ' }).expect(429);
    expect(sendMail).toHaveBeenCalledTimes(3);
    expect(db.otpCode.create).toHaveBeenCalledTimes(3);
  });

  it('expires signup OTP five minutes after creation and reports time remaining after email delivery', async () => {
    const issuedAt = Date.now();
    const clock = vi.spyOn(Date, 'now').mockReturnValue(issuedAt);
    db.user.findUnique.mockResolvedValue(null);
    sendMail.mockImplementationOnce(async () => {
      clock.mockReturnValue(issuedAt + 12000);
      return { messageId: 'mock' };
    });
    try {
      const response = await request(app).post('/auth/send-otp').send({ email: 'new@gmail.com' }).expect(200);
      const expiry = new Date(issuedAt + 5 * 60 * 1000);
      expect(response.body.expiresAt).toBe(expiry.toISOString());
      expect(Date.parse(response.body.expiresAt) - Date.parse(response.body.serverTime)).toBe(288000);
      expect(db.otpCode.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ expiresAt: expiry, attempts: 0 }),
      });
      expect(sendMail).toHaveBeenCalledWith(expect.objectContaining({
        text: expect.stringContaining('expires in 5 minutes'),
        html: expect.stringContaining('<strong>5 minutes</strong>'),
      }));
    } finally {
      clock.mockRestore();
    }
  });
  it('rejects an expired signup code without creating an account', async () => {
    db.user.findUnique.mockResolvedValue(null);
    db.profile.findFirst.mockResolvedValue(null);
    db.otpCode.updateMany.mockResolvedValue({ count: 0 });
    await request(app).post('/auth/register').send({
      email: 'new@gmail.com', password: 'ExamplePass123', displayName: 'New User', city: 'Poblacion', otpCode: '123456',
    }).expect(400);
    expect(db.otpCode.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ expiresAt: { gt: expect.any(Date) } }),
    }));
    expect(db.user.create).not.toHaveBeenCalled();
    expect(db.otpCode.deleteMany).not.toHaveBeenCalled();
  });

  it.each([null, 'google-alice'])('blocks signup OTP for an existing account with Google identity %s without writes', async (googleIdentityId) => {
    db.user.findUnique.mockResolvedValue({ ...user, googleIdentityId });
    const result = await request(app).post('/auth/send-otp').send({ email: ' Alice@Gmail.COM ' }).expect(409);
    expect(result.body.message).toBe('An ECOBUD account already exists for this email.');
    expect(db.user.findUnique).toHaveBeenCalledWith({ where: { email: user.email } });
    expect(sendMail).not.toHaveBeenCalled();
    expect(db.otpCode.upsert).not.toHaveBeenCalled();
    expect(db.otpCode.updateMany).not.toHaveBeenCalled();
    expect(db.otpCode.deleteMany).not.toHaveBeenCalled();
    expect(db.user.create).not.toHaveBeenCalled();
    expect(db.user.update).not.toHaveBeenCalled();
  });
  it('blocks registration of an existing Google email even with a previously requested code', async () => {
    db.user.findUnique.mockResolvedValue({ ...user, googleIdentityId: 'google-alice' });
    await request(app).post('/auth/register').send({
      email: ' Alice@Gmail.COM ', password: 'ExamplePass123', displayName: 'Alice New', city: 'Poblacion', otpCode: '123456',
    }).expect(409);
    expect(db.user.findUnique).toHaveBeenCalledWith({ where: { email: user.email } });
    expect(db.otpCode.updateMany).not.toHaveBeenCalled();
    expect(db.otpCode.deleteMany).not.toHaveBeenCalled();
    expect(db.user.create).not.toHaveBeenCalled();
    expect(db.user.update).not.toHaveBeenCalled();
  });
  it('sends signup OTP for a new email using its normalized address', async () => {
    db.user.findUnique.mockResolvedValue(null);
    sendMail.mockResolvedValue({ messageId: 'mock' });
    await request(app).post('/auth/send-otp').send({ email: ' New.User@Gmail.COM ' }).expect(200);
    expect(db.user.findUnique).toHaveBeenCalledWith({ where: { email: 'new.user@gmail.com' } });
    expect(db.otpCode.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ email: 'new.user@gmail.com' }) }));
    expect(sendMail).toHaveBeenCalledWith(expect.objectContaining({ to: 'new.user@gmail.com' }));
  });

  it('rejects email-only Google login without looking up the victim', async () => {
    await request(app).post('/auth/google').send({ email: 'admin@ecobud.app' }).expect(400);
    expect(db.user.findUnique).not.toHaveBeenCalled();
  });
  it('uses the verified identity rather than a supplied admin email', async () => {
    db.user.findUnique.mockResolvedValue({ ...user, googleIdentityId: 'google-alice' });
    const result = await request(app).post('/auth/google').send({ accessToken: 'verified', email: 'admin@ecobud.app' }).expect(200);
    expect(db.user.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { email: user.email } }));
    expect(TokenService.verify(result.body.token).role).toBe('user');
    expect(result.body.user.isGoogleAccount).toBe(true);
  });
  it('does not grant privileged accounts Google sessions', async () => {
    db.user.findUnique.mockResolvedValue({ ...user, role: 'admin' });
    await request(app).post('/auth/google').send({ accessToken: 'verified' }).expect(403);
  });
  it('does not disclose an account or location without verified identity', async () => {
    await request(app).get('/auth/check-email?email=alice@gmail.com').expect(401);
    expect(db.user.findUnique).not.toHaveBeenCalled();
  });
  it('rejects a challenge token used as an access token', async () => {
    const other = jwt.sign({ ...user, userId: user.id }, JWT_SECRET, { audience: 'challenge-analysis', issuer: 'ecobud-api', expiresIn: '15m' });
    await request(app).get('/private').auth(other, { type: 'bearer' }).expect(401);
  });
  it('rejects revoked access sessions', async () => {
    db.user.findUnique.mockResolvedValue({ ...user, sessionVersion: 1 });
    await request(app).get('/private').auth(token(), { type: 'bearer' }).expect(401);
  });
  it('prevents an email change through preferences', async () => {
    await request(app).patch('/users/me/preferences').auth(token(), { type: 'bearer' }).send({ email: 'attacker@gmail.com' }).expect(400);
    expect(db.user.update).not.toHaveBeenCalled();
  });
  it('revokes previous sessions when changing a password and returns a valid replacement', async () => {
    const result = await request(app).patch('/users/me/security').auth(token(), { type: 'bearer' }).send({ currentPassword: 'old-password', newPassword: 'newPassword123' }).expect(200);
    expect(db.user.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ sessionVersion: { increment: 1 } }) }));
    expect(TokenService.verify(result.body.token).sessionVersion).toBe(1);
  });
  it('blocks password and email security updates for Google-linked accounts', async () => {
    db.user.findUnique.mockResolvedValue({ ...user, googleIdentityId: 'google-alice' });
    await request(app).patch('/users/me/security').auth(token(), { type: 'bearer' }).send({ newPassword: 'newPassword123' }).expect(403);
    expect(compare).not.toHaveBeenCalled();
  });
  it('blocks email verification code requests for Google-linked accounts', async () => {
    db.user.findUnique.mockResolvedValue({ ...user, googleIdentityId: 'google-alice' });
    await request(app).post('/users/me/email-code').auth(token(), { type: 'bearer' }).send({ newEmail: 'new@gmail.com' }).expect(403);
    expect(compare).not.toHaveBeenCalled();
    expect(sendMail).not.toHaveBeenCalled();
  });
  it('requires a verification code before changing email', async () => {
    db.user.findUnique.mockResolvedValueOnce(user).mockResolvedValueOnce(user).mockResolvedValueOnce(null);
    await request(app).patch('/users/me/security').auth(token(), { type: 'bearer' }).send({ currentPassword: 'old-password', newEmail: 'new@gmail.com' }).expect(400);
    expect(db.user.update).not.toHaveBeenCalled();
  });
  it('returns failure when OTP delivery fails', async () => {
    db.user.findUnique.mockResolvedValue(null); sendMail.mockRejectedValue(new Error('SMTP private details'));
    const result = await request(app).post('/auth/send-otp').send({ email: 'alice@gmail.com' }).expect(503);
    expect(result.body.message).not.toContain('SMTP');
    expect(db.otpCode.deleteMany).toHaveBeenCalled();
  });
  it('rejects wrong email verification codes without changing the account', async () => {
    db.user.findUnique.mockResolvedValueOnce(user).mockResolvedValueOnce(user).mockResolvedValueOnce(null);
    db.otpCode.updateMany.mockResolvedValue({ count: 1 });
    db.otpCode.deleteMany.mockResolvedValue({ count: 0 });
    await request(app).patch('/users/me/security').auth(token(), { type: 'bearer' }).send({ currentPassword: 'password', newEmail: 'new@gmail.com', emailCode: '123456' }).expect(400);
    expect(db.user.update).not.toHaveBeenCalled();
  });
  it('consumes a valid email code and revokes sessions atomically', async () => {
    db.user.findUnique.mockResolvedValueOnce(user).mockResolvedValueOnce(user).mockResolvedValueOnce(null);
    db.otpCode.updateMany.mockResolvedValue({ count: 1 }); db.otpCode.deleteMany.mockResolvedValue({ count: 1 });
    await request(app).patch('/users/me/security').auth(token(), { type: 'bearer' }).send({ currentPassword: 'password', newEmail: 'new@gmail.com', emailCode: '123456' }).expect(200);
    expect(db.user.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ email: 'new@gmail.com', googleIdentityId: null, sessionVersion: { increment: 1 } }) }));
  });
});
