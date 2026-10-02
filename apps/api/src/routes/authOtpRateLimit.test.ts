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
describe('signup OTP IP rate limit', () => {
  it('blocks a fourth request with a new email or spoofed forwarded IP', async () => {
    const app = express();
    app.use(express.json());
    app.use('/auth', authRoutes);
    app.use(errorResponder);
    for (const email of ['ip1@gmail.com', 'ip2@gmail.com', 'ip3@gmail.com']) {
      await request(app).post('/auth/send-otp').send({ email }).expect(200);
    }
    const response = await request(app).post('/auth/send-otp')
      .set('X-Forwarded-For', '203.0.113.10').send({ email: 'different@gmail.com' }).expect(429);
    expect(Number(response.headers['retry-after'])).toBeGreaterThan(0);
    expect(mocks.sendMail).toHaveBeenCalledTimes(3);
    expect(mocks.db.otpCode.create).toHaveBeenCalledTimes(3);
  });
});
