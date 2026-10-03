import express from 'express';
import request from 'supertest';
import { expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ findMany: vi.fn(), getOrSet: vi.fn() }));
vi.mock('../prismaClient', () => ({ prisma: { user: { findMany: mocks.findMany } } }));
vi.mock('../lib/cache', () => ({ apiCache: { getOrSet: mocks.getOrSet } }));
vi.mock('../http/authentication', () => ({
  authenticateRequest: (req: any, _res: any, next: () => void) => {
    req.auth = { userId: 'user-12' };
    next();
  },
  requireUserAccess: (_req: any, _res: any, next: () => void) => next(),
}));
vi.mock('../services/ecoGuideService', () => ({ getEcoGuideReply: vi.fn() }));
import { experienceRoutes } from './experienceRoutes';

it('includes ranks beyond the first page and the current user outside the top ten', async () => {
  const users = Array.from({ length: 23 }, (_, index) => ({
    id: `user-${index + 1}`, name: `Resident ${index + 1}`,
    points: 1000 - index, profile: null, badges: [],
  }));
  mocks.findMany.mockImplementation(async (query) => users.slice(0, query.take ?? users.length));
  mocks.getOrSet.mockImplementation(async (_key, _ttl, fetch) => fetch());
  const app = express();
  app.use('/experience', experienceRoutes);
  const response = await request(app).get('/experience/leaderboard').expect(200);
  expect(response.body.items).toHaveLength(23);
  expect(response.body.items.slice(10, 20).map((item: any) => item.rank)).toEqual([11, 12, 13, 14, 15, 16, 17, 18, 19, 20]);
  expect(response.body.items.slice(20).map((item: any) => item.rank)).toEqual([21, 22, 23]);
  expect(response.body.currentUserRank).toBe(12);
  expect(response.body.items[11].isCurrentUser).toBe(true);
  expect(mocks.findMany.mock.calls[0][0].where).toEqual({ status: 'active', role: 'user' });
  expect(mocks.getOrSet.mock.calls[0][0]).toBe('global_leaderboard_all_users');
});
