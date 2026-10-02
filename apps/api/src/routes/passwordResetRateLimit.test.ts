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

  it('blocks a fourth reset request without consuming login or signup limits', async () => {
    const app = express(); app.use(express.json()); app.use('/auth', authRoutes); app.use(errorResponder);
    for (let i = 0; i < 3; i++) {
      await request(app).post('/auth/password-reset/request-code').send({ email: `reset-ip-${i}@gmail.com` }).expect(200);
    }
    const blocked = await request(app).post('/auth/password-reset/request-code').send({ email: 'different@gmail.com' }).expect(429);
    expect(Number(blocked.headers['retry-after'])).toBeGreaterThan(0);
    await request(app).post('/auth/login').send({ email: 'unknown@gmail.com', password: 'Password123' }).expect(401);
    await request(app).post('/auth/send-otp').send({ email: 'new-signup@gmail.com' }).expect(200);
    expect(mocks.sendMail).toHaveBeenCalledOnce();
  });
});