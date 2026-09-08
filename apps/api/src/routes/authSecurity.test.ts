import { beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
const { db, google, compare, sendMail } = vi.hoisted(() => ({
  db: { user: { findUnique: vi.fn(), update: vi.fn(), create: vi.fn() }, profile: { findFirst: vi.fn(), upsert: vi.fn() }, otpCode: { findUnique: vi.fn(), upsert: vi.fn(), updateMany: vi.fn(), deleteMany: vi.fn() }, $transaction: vi.fn() },
  google: vi.fn(), compare: vi.fn(), sendMail: vi.fn(),
}));
vi.mock('../prismaClient', () => ({ prisma: db }));
vi.mock('../security/googleIdentity', () => ({ verifyGoogleIdentity: google }));
vi.mock('../security/passwordService', () => ({ PasswordService: { compare, hash: vi.fn(async () => 'new-hash') } }));
vi.mock('nodemailer', () => ({ default: { createTransport: () => ({ sendMail }) } }));
vi.mock('../services/supabaseStorageService', () => ({ supabaseStorageService: {} }));
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
  db.user.findUnique.mockResolvedValue({ ...user });
  db.user.update.mockResolvedValue({ ...user, sessionVersion: 1 });
  db.$transaction.mockImplementation(async (fn) => fn(db));
  compare.mockResolvedValue(true);
  google.mockResolvedValue({ id: 'google-alice', email: user.email, name: user.name, canLinkByEmail: true });
});
describe('authentication security regressions', () => {
  it('rejects email-only Google login without looking up the victim', async () => {
    await request(app).post('/auth/google').send({ email: 'admin@ecobud.app' }).expect(400);
    expect(db.user.findUnique).not.toHaveBeenCalled();
  });
  it('uses the verified identity rather than a supplied admin email', async () => {
    db.user.findUnique.mockResolvedValue({ ...user, googleIdentityId: 'google-alice' });
    const result = await request(app).post('/auth/google').send({ accessToken: 'verified', email: 'admin@ecobud.app' }).expect(200);
    expect(db.user.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { email: user.email } }));
    expect(TokenService.verify(result.body.token).role).toBe('user');
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
