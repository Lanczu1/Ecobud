import express from 'express';
import request from 'supertest';
import { beforeEach, expect, it, vi } from 'vitest';
const { db, swap, learn } = vi.hoisted(() => ({
  db: { user: { findUnique: vi.fn() } },
  swap: { fetchListings: vi.fn(), createListing: vi.fn(), sendSwapRequest: vi.fn(), uploadImage: vi.fn() },
  learn: vi.fn(),
}));
vi.mock('../prismaClient', () => ({ prisma: db }));
vi.mock('../services/swapService', () => ({ swapService: swap }));
vi.mock('../services/notificationService', () => ({ sendDirectNotification: vi.fn() }));
vi.mock('../services/supabaseRealtimeService', () => ({ supabaseRealtimeService: { publishSwapEvent: vi.fn(async () => true) } }));
vi.mock('../controllers/learnController', () => ({ learnController: { getLessons: learn, markSeen: learn, updateProgress: learn, completeLesson: learn } }));
vi.mock('../http/authentication', () => ({
  authenticateRequest: (req: any, _res: any, next: () => void) => { req.auth = { userId: 'resident', role: 'user' }; next(); },
  requireUserAccess: (_req: unknown, _res: unknown, next: () => void) => next(),
}));
import swapRoutes from './swapRoutes';
import { learnRoutes } from './learnRoutes';
import { errorResponder } from '../http/errorResponder';
const app = express(); app.use(express.json()); app.use('/swap', swapRoutes); app.use('/learn', learnRoutes); app.use(errorResponder);
beforeEach(() => {
  vi.clearAllMocks();
  db.user.findUnique.mockResolvedValue({ idVerificationStatus: 'pending' });
  swap.fetchListings.mockResolvedValue([]);
  swap.createListing.mockResolvedValue({ id: 'listing' });
  learn.mockImplementation(async (_req: unknown, res: express.Response) => res.json({ ok: true }));
});
it.each(['/swap/listings', '/swap/requests', '/swap/upload-image'])('blocks pending users at %s before creating anything', async path => {
  const result = await request(app).post(path).send({ title: 'Reuse' }).expect(403);
  expect(result.body.code).toBe('ID_APPROVAL_REQUIRED');
  expect(swap.createListing).not.toHaveBeenCalled(); expect(swap.sendSwapRequest).not.toHaveBeenCalled(); expect(swap.uploadImage).not.toHaveBeenCalled();
});
it('keeps marketplace browsing available while pending', async () => {
  await request(app).get('/swap/listings').expect(200);
});
it.each(['/learn/seen', '/learn/progress', '/learn/complete'])('allows pending users through to Learn at %s', async path => {
  await request(app).post(path).send({ lessonId: 'lesson' }).expect(200);
  expect(learn).toHaveBeenCalledOnce();
});
it('uses the approved authenticated owner when a create request spoofs another user', async () => {
  db.user.findUnique.mockResolvedValue({ idVerificationStatus: 'approved' });
  await request(app).post('/swap/listings').send({ title: 'Reuse', userId: 'someone-else' }).expect(201);
  expect(swap.createListing).toHaveBeenCalledWith({ title: 'Reuse', userId: 'resident' });
});
