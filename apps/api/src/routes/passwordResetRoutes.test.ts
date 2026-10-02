import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';

const mocks = vi.hoisted(() => ({
  db: { user: { findUnique: vi.fn(), updateMany: vi.fn() }, otpCode: { findUnique: vi.fn(), updateMany: vi.fn(), create: vi.fn(), deleteMany: vi.fn() }, $transaction: vi.fn() },
  sendMail: vi.fn(),
}));
vi.mock('../prismaClient', () => ({ prisma: mocks.db }));
vi.mock('nodemailer', () => ({ default: { createTransport: () => ({ sendMail: mocks.sendMail }) } }));
vi.mock('express-rate-limit', () => ({ default: () => (_req: unknown, _res: unknown, next: () => void) => next() }));
vi.mock('../services/notificationService', () => ({ sendDirectNotification: vi.fn() }));
import { authRoutes } from './authRoutes';
import { errorResponder } from '../http/errorResponder';
import { authenticateRequest } from '../http/authentication';
import { PasswordService } from '../security/passwordService';
import { TokenService, JWT_SECRET } from '../security/tokenService';

const app = express();
app.use(express.json()); app.use('/auth', authRoutes);
app.get('/private', authenticateRequest, (_req, res) => res.json({ ok: true }));
app.use(errorResponder);
const base = '/auth/password-reset';
type Row = { email: string; code: string; attempts: number; expiresAt: Date };
let rows = new Map<string, Row>();
let user: any;
let failUpdate = false;
let serial = Promise.resolve();
let addressNumber = 0;
const matchesRow = (row: Row, where: any) => (!where.code || row.code === where.code)
  && (!where.expiresAt?.gt || row.expiresAt > where.expiresAt.gt)
  && (!where.expiresAt?.lte || row.expiresAt <= where.expiresAt.lte)
  && (where.attempts?.lt === undefined || row.attempts < where.attempts.lt)
  && (where.attempts?.lte === undefined || row.attempts <= where.attempts.lte);

beforeEach(async () => {
  vi.clearAllMocks(); rows = new Map(); failUpdate = false; serial = Promise.resolve();
  user = { id: 'reset-user', email: `reset${++addressNumber}@gmail.com`, name: 'Reset Tester', status: 'active', role: 'user',
    googleIdentityId: null, sessionVersion: 3, passwordHash: await PasswordService.hash('OldPassword123'),
    points: 123, currentStreak: 4, lastActionDate: null, profile: null, totpEnabledAt: null };
  mocks.sendMail.mockReset().mockResolvedValue({ messageId: 'mock' });
  mocks.db.user.findUnique.mockImplementation(async ({ where }) => user && (where.email === user.email || where.id === user.id) ? { ...user } : null);
  mocks.db.user.updateMany.mockImplementation(async ({ where, data }) => {
    if (failUpdate) { failUpdate = false; return { count: 0 }; }
    if (!user || Object.entries(where).some(([key, value]) => user[key] !== value)) return { count: 0 };
    user.passwordHash = data.passwordHash; user.sessionVersion += data.sessionVersion.increment;
    return { count: 1 };
  });
  mocks.db.otpCode.findUnique.mockImplementation(async ({ where }) => rows.get(where.email) ? { ...rows.get(where.email)! } : null);
  mocks.db.otpCode.create.mockImplementation(async ({ data }) => {
    if (rows.has(data.email)) throw { code: 'P2002' };
    const row = { attempts: 0, ...data }; rows.set(data.email, row); return row;
  });
  mocks.db.otpCode.updateMany.mockImplementation(async ({ where, data }) => {
    const row = rows.get(where.email);
    if (!row || !matchesRow(row, where)) return { count: 0 };
    rows.set(where.email, { ...row, ...data, attempts: typeof data.attempts === 'number' ? data.attempts : row.attempts + data.attempts.increment });
    return { count: 1 };
  });
  mocks.db.otpCode.deleteMany.mockImplementation(async ({ where }) => {
    const row = rows.get(where.email);
    if (!row || !matchesRow(row, where)) return { count: 0 };
    rows.delete(where.email); return { count: 1 };
  });
  mocks.db.$transaction.mockImplementation((callback) => {
    const run = serial.then(async () => {
      const savedRows = new Map([...rows].map(([key, value]) => [key, { ...value }]));
      const savedUser = user ? { ...user } : null;
      try { return await callback(mocks.db); }
      catch (error) { rows = savedRows; user = savedUser; throw error; }
    });
    serial = run.then(() => undefined, () => undefined);
    return run;
  });
});
afterEach(() => vi.useRealTimers());
const send = (email = user.email) => request(app).post(`${base}/request-code`).send({ email });
const mailedCode = () => mocks.sendMail.mock.calls.at(-1)![0].text.match(/code is (\d{6})/)[1];
const verify = (code: string, email = user.email) => request(app).post(`${base}/verify-code`).send({ email, code });
const grant = async () => { await send().expect(200); return (await verify(mailedCode()).expect(200)).body.resetToken as string; };
const complete = (resetToken: string, password = 'NewPassword456') => request(app).post(`${base}/complete`).send({ resetToken, password });

describe('isolated password reset', () => {
  it.each([false, true])('explicitly blocks Google-linked reset requests even with a pending code: %s', async (pending) => {
    if (pending) await send().expect(200);
    const original = new Map([...rows].map(([key, value]) => [key, { ...value }]));
    user.googleIdentityId = 'google-id';
    vi.clearAllMocks();
    const response = await send(' ' + user.email.toUpperCase() + ' ').expect(403);
    expect(response.body.message).toBe('This account uses Google sign-in. Please use Continue with Google.');
    expect(mocks.sendMail).not.toHaveBeenCalled();
    expect(mocks.db.otpCode.findUnique).not.toHaveBeenCalled();
    expect(mocks.db.otpCode.create).not.toHaveBeenCalled();
    expect(mocks.db.otpCode.updateMany).not.toHaveBeenCalled();
    expect(mocks.db.otpCode.deleteMany).not.toHaveBeenCalled();
    expect(mocks.db.user.updateMany).not.toHaveBeenCalled();
    expect(rows).toEqual(original);
  });

  it('allows only one verification and one reset when requests arrive together', async () => {
    await send().expect(200); const code = mailedCode();
    const verified = await Promise.all([verify(code), verify(code)]);
    expect(verified.map((response) => response.status).sort()).toEqual([200, 400]);
    const token = verified.find((response) => response.status === 200)!.body.resetToken;
    const completed = await Promise.all([complete(token), complete(token)]);
    expect(completed.map((response) => response.status).sort()).toEqual([200, 400]);
    expect(user.sessionVersion).toBe(4);
  });
  it('limits reset-code issuance per email even across consumed OTPs', async () => {
    for (let i = 0; i < 3; i++) { await send().expect(200); await verify(mailedCode()).expect(200); }
    await send().expect(429);
    expect(mocks.sendMail).toHaveBeenCalledTimes(3);
    expect(mocks.db.user.updateMany).not.toHaveBeenCalled();
  });

  it('resets the password, revokes access and refresh sessions, and keeps login working', async () => {
    const original = { ...user };
    const access = TokenService.sign({ ...user, userId: user.id });
    const refresh = TokenService.signRefresh({ userId: user.id, sessionVersion: user.sessionVersion });
    await complete(await grant()).expect(200);
    expect(await PasswordService.compare('NewPassword456', user.passwordHash)).toBe(true);
    expect(user).toMatchObject({ ...original, passwordHash: expect.any(String), sessionVersion: original.sessionVersion + 1 });
    expect(mocks.db.user.updateMany.mock.calls[0][0].data).toEqual({ passwordHash: user.passwordHash, sessionVersion: { increment: 1 } });
    await request(app).get('/private').auth(access, { type: 'bearer' }).expect(401);
    await request(app).post('/auth/refresh').send({ refreshToken: refresh }).expect(401);
    await request(app).post('/auth/login').send({ email: user.email, password: 'OldPassword123' }).expect(401);
    const login = await request(app).post('/auth/login').send({ email: user.email, password: 'NewPassword456' }).expect(200);
    expect(TokenService.verify(login.body.token).sessionVersion).toBe(user.sessionVersion);
  });
  it('keeps signup and email-change codes separate and stores a hashed reset code', async () => {
    const signup = { email: user.email, code: 'signup', attempts: 2, expiresAt: new Date(Date.now() + 300000) };
    const change = { ...signup, email: `change:${user.id}:${user.email}`, code: 'email-change' };
    rows.set(signup.email, signup); rows.set(change.email, change);
    await send(` ${user.email.toUpperCase()} `).expect(200);
    expect(rows.get(user.email)).toEqual(signup);
    expect(rows.get(change.email)).toEqual(change);
    expect(rows.get(`reset-code:${user.email}`)!.code).not.toBe(mailedCode());
    await verify(mailedCode()).expect(200);
    expect(rows.get(user.email)).toEqual(signup);
    expect(rows.get(change.email)).toEqual(change);
  });
  it.each(['unknown', 'suspended', 'admin'])('does not expose or reset an ineligible %s account', async (kind) => {
    const email = user.email;
    if (kind === 'unknown') user = null;
    if (kind === 'suspended') user.status = 'suspended';
    if (kind === 'admin') user.role = 'admin';
    const response = await send(email).expect(200);
    expect(response.body.message).toContain('If this email has a password account');
    expect(response.body.expiresAt).toBeTruthy();
    expect(mocks.sendMail).not.toHaveBeenCalled();
    await verify('123456', email).expect(400);
    expect(mocks.db.user.updateMany).not.toHaveBeenCalled();
  });
  it('preserves an active code and attempt count on repeated requests', async () => {
    await send().expect(200); const key = `reset-code:${user.email}`;
    const first = { ...rows.get(key)! }; rows.get(key)!.attempts = 5;
    const response = await send().expect(200);
    expect(rows.get(key)).toEqual({ ...first, attempts: 5 });
    expect(response.body.expiresAt).toBe(first.expiresAt.toISOString());
    expect(mocks.sendMail).toHaveBeenCalledOnce();
  });
  it('sends one email when simultaneous requests race', async () => {
    const responses = await Promise.all([send(), send()]);
    expect(responses.map((response) => response.status)).toEqual([200, 200]);
    expect(mocks.sendMail).toHaveBeenCalledOnce(); expect(rows.size).toBe(1);
  });
  it('allows a new code after expiration', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    await send().expect(200); const old = { ...rows.get(`reset-code:${user.email}`)! };
    vi.setSystemTime(old.expiresAt);
    await send().expect(200);
    expect(mocks.sendMail).toHaveBeenCalledTimes(2);
    expect(rows.get(old.email)!.expiresAt.getTime()).toBe(old.expiresAt.getTime() + 300000);
  });
  it('rejects a correct code after five wrong attempts and cannot bypass by requesting again', async () => {
    await send().expect(200); const correct = mailedCode();
    for (let i = 0; i < 5; i++) await verify('000000').expect(400);
    await send().expect(200); await verify(correct).expect(400);
    expect(mocks.sendMail).toHaveBeenCalledOnce(); expect(mocks.db.user.updateMany).not.toHaveBeenCalled();
  });
  it('rejects a code at its expiration time', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    await send().expect(200); const code = mailedCode();
    vi.setSystemTime(rows.get(`reset-code:${user.email}`)!.expiresAt);
    await verify(code).expect(400); expect(mocks.db.user.updateMany).not.toHaveBeenCalled();
  });
  it('consumes an OTP once and the resulting reset authorization once', async () => {
    await send().expect(200); const code = mailedCode();
    const response = await verify(code).expect(200);
    await verify(code).expect(400);
    await complete(response.body.resetToken).expect(200);
    await complete(response.body.resetToken).expect(400);
    expect(mocks.db.user.updateMany).toHaveBeenCalledOnce();
  });
  it('rejects expired reset authorization', async () => {
    vi.useFakeTimers({ toFake: ['Date'] }); const token = await grant();
    const claims = jwt.decode(token) as { exp: number };
    vi.setSystemTime(claims.exp * 1000);
    await complete(token).expect(400); expect(mocks.db.user.updateMany).not.toHaveBeenCalled();
  });
  it.each(['access', 'refresh', 'tampered'])('rejects %s tokens as reset authorization', async (kind) => {
    const token = kind === 'access' ? TokenService.sign({ ...user, userId: user.id })
      : kind === 'refresh' ? TokenService.signRefresh({ userId: user.id, sessionVersion: user.sessionVersion })
      : (await grant()).slice(0, -10) + 'tamperedxx';
    await complete(token).expect(400); expect(mocks.db.user.updateMany).not.toHaveBeenCalled();
  });
  it('reset tokens cannot grant access or refresh sessions', async () => {
    const token = await grant();
    await request(app).get('/private').auth(token, { type: 'bearer' }).expect(401);
    await request(app).post('/auth/refresh').send({ refreshToken: token }).expect(401);
    expect(() => jwt.verify(token, JWT_SECRET, { audience: 'ecobud-access' })).toThrow();
  });
  it.each(['version', 'email', 'google', 'status'])('invalidates authorization after account %s changes', async (kind) => {
    const token = await grant();
    if (kind === 'version') user.sessionVersion++;
    if (kind === 'email') user.email = 'changed@gmail.com';
    if (kind === 'google') user.googleIdentityId = 'new-google-id';
    if (kind === 'status') user.status = 'suspended';
    await complete(token).expect(400); expect(mocks.db.user.updateMany).not.toHaveBeenCalled();
  });
  it('keeps two-step verification and recovery settings enabled after reset', async () => {
    user.totpEnabledAt = new Date(); user.totpSecretEncrypted = 'unchanged'; user.totpLastUsedStep = 123n;
    await complete(await grant()).expect(200);
    expect(user).toMatchObject({ totpEnabledAt: expect.any(Date), totpSecretEncrypted: 'unchanged', totpLastUsedStep: 123n });
  });
  it.each(['short', 'PasswordOnly', '123456789', 'a'.repeat(72) + '1'])('rejects an invalid new password without consuming authorization', async (password) => {
    const token = await grant(); await complete(token, password).expect(400);
    expect(mocks.db.user.updateMany).not.toHaveBeenCalled(); await complete(token).expect(200);
  });
  it('rolls back grant consumption if updating the password fails', async () => {
    const original = { ...user }; const token = await grant(); failUpdate = true;
    await complete(token).expect(400); expect(user).toEqual(original);
    await complete(token).expect(200);
  });
  it('keeps a generic response and existing password if SMTP fails', async () => {
    const original = { ...user }; mocks.sendMail.mockRejectedValue(new Error('private SMTP failure'));
    const response = await send().expect(200);
    expect(response.body.message).toContain('If this email has a password account');
    expect(response.body.message).not.toContain('SMTP'); expect(user).toEqual(original);
    expect(mocks.db.user.updateMany).not.toHaveBeenCalled();
  });
});