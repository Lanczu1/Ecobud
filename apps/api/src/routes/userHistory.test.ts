import { beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';

const { db } = vi.hoisted(() => ({
  db: {
    user: { findUnique: vi.fn() },
    transparencyLog: { findMany: vi.fn() },
  },
}));
vi.mock('../prismaClient', () => ({ prisma: db }));
vi.mock('../http/authentication', () => ({
  authenticateRequest: (req: any, _res: any, next: any) => { req.auth = { userId: 'member' }; next(); },
  requireUserAccess: (_req: any, _res: any, next: any) => next(),
}));
vi.mock('../http/uploadMiddleware', () => ({ avatarUploadMiddleware: { single: () => (_req: any, _res: any, next: any) => next() } }));
vi.mock('../services/supabaseStorageService', () => ({ supabaseStorageService: {} }));
vi.mock('../security/emailChange', () => ({ emailChangeKey: vi.fn(), emailCodeHash: vi.fn(), sendEmailChangeCode: vi.fn() }));
import { userRoutes } from './userRoutes';
import { errorResponder } from '../http/errorResponder';

const app = express();
app.use('/users', userRoutes);
app.use(errorResponder);

beforeEach(() => {
  vi.resetAllMocks();
  db.user.findUnique.mockResolvedValue({ id: 'member', badges: [], eventRegistrations: [], lessonProgress: [], challengeProgress: [] });
});

describe('profile reward history', () => {
  it('returns recorded coins as structured metadata for the history screen', async () => {
    db.transparencyLog.findMany.mockResolvedValue([
      { id: 'event', pointsAwarded: 100, metadata: JSON.stringify({ eventId: 'cleanup', ecoCoinsAwarded: 10 }) },
      { id: 'lesson', pointsAwarded: 10, metadata: JSON.stringify({ lessonId: '3rs', ecoCoinsAwarded: 0 }) },
    ]);
    const response = await request(app).get('/users/me').expect(200);
    expect(response.body.recentLogs).toEqual([
      { id: 'event', pointsAwarded: 100, metadata: { eventId: 'cleanup', ecoCoinsAwarded: 10 } },
      { id: 'lesson', pointsAwarded: 10, metadata: { lessonId: '3rs', ecoCoinsAwarded: 0 } },
    ]);
    expect(db.transparencyLog.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: 'member' } }));
  });

  it('returns empty metadata for older logs without metadata', async () => {
    db.transparencyLog.findMany.mockResolvedValue([{ id: 'old', pointsAwarded: 10, metadata: null }]);
    const response = await request(app).get('/users/me').expect(200);
    expect(response.body.recentLogs[0].metadata).toEqual({});
  });
});
