import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../prismaClient', () => ({ prisma: {} }));
vi.mock('../http/authentication', async (importOriginal) => {
  const original = await importOriginal<typeof import('../http/authentication')>();
  return {
    ...original,
    authenticateRequest: (req: any, res: any, next: any) => {
      const role = req.headers.authorization?.replace('Bearer ', '');
      if (!role) return res.sendStatus(401);
      req.auth = { userId: 'viewer', role, city: req.headers['x-test-barangay'] };
      next();
    },
  };
});
vi.mock('../controllers/adminController', () => ({
  AdminController: new Proxy({}, {
    get: (_target, name) => name === 'createChallenge'
      ? createChallenge
      : (_req: any, res: any) => res.sendStatus(200),
  }),
}));
const { createChallenge } = vi.hoisted(() => ({
  createChallenge: vi.fn((_req: any, res: any) => res.status(201).json({ id: 'new-challenge' })),
}));
vi.mock('./adminUserActivityRoutes', () => ({ adminUserActivityRoutes: express.Router() }));
vi.mock('./barangayReportRoutes', () => ({ barangayReportRoutes: express.Router() }));
vi.mock('./reportRoutes', () => ({ default: express.Router() }));
vi.mock('./adminBadgeRoutes', () => ({ adminBadgeRoutes: express.Router() }));
vi.mock('./eventPhotoDeletionRoutes', () => ({ adminEventPhotoDeletionRoutes: express.Router() }));
vi.mock('./challengePhotoDeletionRoutes', () => ({ adminChallengePhotoDeletionRoutes: express.Router() }));
vi.mock('../http/uploadMiddleware', () => {
  const upload = { single: () => (_req: any, _res: any, next: any) => next(), fields: () => (_req: any, _res: any, next: any) => next() };
  return { uploadMiddleware: upload, challengeUploadMiddleware: upload, eventUploadMiddleware: upload };
});

import { adminRoutes } from './adminRoutes';
import { BARANGAYS } from '../utils/announcementBarangays';

const app = express();
app.use(express.json());
app.use('/admin', adminRoutes);

describe('challenge creation access', () => {
  beforeEach(() => vi.clearAllMocks());

  it.each(BARANGAYS)('allows the moderator assigned to %s to create a challenge', async barangay => {
    const response = await request(app).post('/admin/challenges')
      .set('Authorization', 'Bearer moderator').set('x-test-barangay', barangay)
      .send({ title: 'Recycle bottles' });
    expect(response.status).toBe(201);
    expect(response.body.id).toBe('new-challenge');
    expect(createChallenge).toHaveBeenCalledOnce();
  });

  it('continues to allow administrators', async () => {
    expect((await request(app).post('/admin/challenges').set('Authorization', 'Bearer admin').send({})).status).toBe(201);
    expect(createChallenge).toHaveBeenCalledOnce();
  });

  it.each(['user', 'staff'])('denies creation by %s accounts before the controller runs', async role => {
    expect((await request(app).post('/admin/challenges').set('Authorization', `Bearer ${role}`).send({})).status).toBe(403);
    expect(createChallenge).not.toHaveBeenCalled();
  });

  it('requires authentication', async () => {
    expect((await request(app).post('/admin/challenges').send({})).status).toBe(401);
    expect(createChallenge).not.toHaveBeenCalled();
  });

  it('keeps challenge updates restricted to administrators', async () => {
    expect((await request(app).put('/admin/challenges/existing').set('Authorization', 'Bearer moderator').send({})).status).toBe(403);
    expect((await request(app).put('/admin/challenges/existing').set('Authorization', 'Bearer admin').send({})).status).toBe(200);
  });
});
