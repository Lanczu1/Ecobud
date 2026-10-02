import { describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
const mocks = vi.hoisted(() => ({ db: { user: { findUnique: vi.fn().mockResolvedValue(null) }, otpCode: {
  findUnique: vi.fn(), updateMany: vi.fn().mockResolvedValue({ count: 0 }),
} }, sendMail: vi.fn() }));
vi.mock('../prismaClient', () => ({ prisma: mocks.db }));
vi.mock('nodemailer', () => ({ default: { createTransport: () => ({ sendMail: mocks.sendMail }) } }));
import { passwordResetRoutes } from './passwordResetRoutes';
import { errorResponder } from '../http/errorResponder';

describe('password reset traffic protection', () => {
  it('caps rapid active-code requests without consuming the verification budget', async () => {
    mocks.db.otpCode.findUnique.mockResolvedValue({ expiresAt: new Date(Date.now() + 300000) });
    const app = express(); app.use(express.json()); app.use('/reset', passwordResetRoutes); app.use(errorResponder);
    for (let i = 0; i < 60; i++) await request(app).post('/reset/request-code').send({ email: 'active@gmail.com' }).expect(200);
    const blocked = await request(app).post('/reset/request-code').send({ email: 'active@gmail.com' }).expect(429);
    expect(blocked.body.message).toContain('shortly');
    expect(Number(blocked.headers['retry-after'])).toBeLessThanOrEqual(60);
    expect(mocks.sendMail).not.toHaveBeenCalled();
    await request(app).post('/reset/verify-code').send({ email: 'active@gmail.com', code: '000000' }).expect(400);
  });
});
