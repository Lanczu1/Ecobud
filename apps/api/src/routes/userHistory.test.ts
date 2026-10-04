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
  it('keeps profile event history bounded while the event directory provides older records', async () => {
    db.user.findUnique.mockResolvedValue({ id: 'member', badges: [], lessonProgress: [], challengeProgress: [],
      eventRegistrations: Array.from({ length: 21 }, (_, index) => ({ event: { id: `event${index}` }, status: 'REGISTERED' })),
    });
    db.transparencyLog.findMany.mockResolvedValue([]);
    const response = await request(app).get('/users/me').expect(200);
    expect(response.body.eventHistory).toHaveLength(20);
    expect(response.body.eventHistoryHasMore).toBe(true);
    expect(db.user.findUnique.mock.calls[0][0].select.eventRegistrations.take).toBe(21);
  });
  it('pages only the signed-in user history and keeps timestamp ties stable', async () => {
    const rows = Array.from({ length: 41 }, (_, index) => ({
      id: `log${String(index).padStart(3, '0')}`, userId: 'member', timestamp: new Date('2026-10-04T00:00:00Z'), metadata: null,
    }));
    rows.push({ ...rows[0], id: 'private', userId: 'someone-else' });
    db.transparencyLog.findMany.mockImplementation(async ({ where, take }) => rows.filter(row => row.userId === where.userId &&
      (!where.OR || where.OR.some((branch: any) => branch.id ? +row.timestamp === +branch.timestamp && row.id < branch.id.lt : row.timestamp < branch.timestamp.lt))
    ).sort((a, b) => +b.timestamp - +a.timestamp || b.id.localeCompare(a.id)).slice(0, take));
    const first = await request(app).get('/users/me/history').expect(200);
    expect(first.body.items).toHaveLength(20);
    expect(first.body.nextCursor).toBeTypeOf('string');
    const second = await request(app).get('/users/me/history').query({ cursor: first.body.nextCursor }).expect(200);
    expect(second.body.items).toHaveLength(20);
    expect(db.transparencyLog.findMany).toHaveBeenLastCalledWith(expect.objectContaining({
      take: 21,
      orderBy: [{ timestamp: 'desc' }, { id: 'desc' }],
      where: { userId: 'member', OR: [
        { timestamp: { lt: new Date('2026-10-04T00:00:00Z') } },
        { timestamp: new Date('2026-10-04T00:00:00Z'), id: { lt: 'log021' } },
      ] },
    }));
    const last = await request(app).get('/users/me/history').query({ cursor: second.body.nextCursor }).expect(200);
    expect(last.body.nextCursor).toBeNull();
    const ids = [...first.body.items, ...second.body.items, ...last.body.items].map(item => item.id);
    expect(ids).toEqual(Array.from({ length: 41 }, (_, index) => `log${String(40 - index).padStart(3, '0')}`));
  });

  it.each(['limit=500', 'cursor=invalid!'])('rejects malformed history paging: %s', async query => {
    await request(app).get(`/users/me/history?${query}`).expect(400);
    expect(db.transparencyLog.findMany).not.toHaveBeenCalled();
  });

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
