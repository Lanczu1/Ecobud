import { describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
const mocks = vi.hoisted(() => ({
  db: { user: { findUnique: vi.fn().mockResolvedValue(null) }, otpCode: {
    findUnique: vi.fn().mockResolvedValue(null), updateMany: vi.fn().mockResolvedValue({ count: 0 }),
    create: vi.fn().mockResolvedValue({}),
  } },
  sendMail: vi.fn().mockResolvedValue({ messageId: 'mock' }),
}));
vi.mock('../prismaClient', () => ({ prisma: mocks.db }));
vi.mock('nodemailer', () => ({ default: { createTransport: () => ({ sendMail: mocks.sendMail }) } }));
vi.mock('../services/notificationService', () => ({ sendDirectNotification: vi.fn() }));
import { authRoutes } from './authRoutes';
import { errorResponder } from '../http/errorResponder';

describe('password reset IP limits stay separate from other authentication', () => {
  it('limits verification guesses per IP without blocking login', async () => {
    const app = express(); app.use(express.json()); app.use('/auth', authRoutes); app.use(errorResponder);
    for (let i = 0; i < 20; i++) {
      await request(app).post('/auth/password-reset/verify-code').send({ email: 'unknown@gmail.com', code: '000000' }).expect(400);
    }
    const blocked = await request(app).post('/auth/password-reset/verify-code').send({ email: 'different@gmail.com', code: '000000' }).expect(429);
    expect(blocked.body.message).toContain('Too many reset verification attempts');
    await request(app).post('/auth/login').send({ email: 'unknown2@gmail.com', password: 'Password123' }).expect(401);
  });

  it('allows a first resend after active-code retries and shared-network traffic, while retaining an IP ceiling', async () => {
    const app = express(); app.use(express.json()); app.use('/auth', authRoutes); app.use(errorResponder);
    const rows = new Map<string, any>();
    const owner = { id: 'owner', email: 'owner@gmail.com', status: 'active', role: 'user', googleIdentityId: null, sessionVersion: 0 };
    mocks.db.user.findUnique.mockImplementation(async ({ where }) => where.email === owner.email ? owner : null);
    mocks.db.otpCode.findUnique.mockImplementation(async ({ where }) => rows.get(where.email) ?? null);
    mocks.db.otpCode.create.mockImplementation(async ({ data }) => {
      if (rows.has(data.email)) throw { code: 'P2002' };
      rows.set(data.email, data); return data;
    });
    mocks.db.otpCode.updateMany.mockImplementation(async ({ where, data }) => {
      const row = rows.get(where.email);
      if (!row || !where.expiresAt?.lte || row.expiresAt > where.expiresAt.lte) return { count: 0 };
      rows.set(where.email, { ...row, ...data }); return { count: 1 };
    });
    const send = (email: string) => request(app).post('/auth/password-reset/request-code').send({ email });
    vi.useFakeTimers({ toFake: ['Date'] });
    try {
      for (let i = 0; i < 7; i++) await send(`shared-network-${i}@gmail.com`).expect(200);
      const initial = await send(owner.email).expect(200);
      for (let i = 0; i < 40; i++) {
        const duplicate = await send(owner.email).expect(200);
        expect(duplicate.body.expiresAt).toBe(initial.body.expiresAt);
      }
      expect(mocks.sendMail).toHaveBeenCalledOnce();
      vi.setSystemTime(new Date(initial.body.expiresAt));
      await send(owner.email).expect(200);
      expect(mocks.sendMail).toHaveBeenCalledTimes(2);
      for (let i = 0; i < 21; i++) await send(`network-ceiling-${i}@gmail.com`).expect(200);
      const blocked = await send('over-network-ceiling@gmail.com').expect(429);
      expect(blocked.body.message).toContain('from this network');
      expect(Number(blocked.headers['retry-after'])).toBeGreaterThan(0);
      expect(Number(blocked.headers['retry-after'])).toBeLessThanOrEqual(900);
      await request(app).post('/auth/login').send({ email: 'unknown@gmail.com', password: 'Password123' }).expect(401);
      await request(app).post('/auth/send-otp').send({ email: 'new-signup@gmail.com' }).expect(200);
      expect(mocks.sendMail).toHaveBeenCalledTimes(3);
    } finally { vi.useRealTimers(); }
  });
});