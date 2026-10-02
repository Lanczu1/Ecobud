import express from 'express';
import request from 'supertest';
import { beforeEach, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => ({ badge: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), deleteMany: vi.fn() } }));
const storage = vi.hoisted(() => ({ uploadFile: vi.fn() }));
vi.mock('../prismaClient', () => ({ prisma: db }));
vi.mock('../services/supabaseStorageService', () => ({ supabaseStorageService: storage }));
vi.mock('../http/authentication', () => ({ requireAdminAccess: (req: express.Request, res: express.Response, next: express.NextFunction) => req.headers['x-role'] === 'admin' ? next() : res.sendStatus(403) }));
import { adminBadgeRoutes } from './adminBadgeRoutes';
import { errorResponder } from '../http/errorResponder';
const app = express();
app.use(express.json());
app.use('/badges', adminBadgeRoutes);
app.use(errorResponder);
const body = { name: 'Eco Helper', description: 'Earn points', iconUrl: 'https://example.com/icon.png', requiredPoints: 100, accentColor: '#16A34A' };
beforeEach(() => vi.resetAllMocks());
it('rejects non-admin access', async () => {
  expect((await request(app).get('/badges').set('x-role', 'moderator')).status).toBe(403);
  expect(db.badge.findMany).not.toHaveBeenCalled();
});
it('validates unlock thresholds before writing', async () => {
  expect((await request(app).post('/badges').set('x-role', 'admin').send({ ...body, requiredPoints: -1 })).status).toBe(400);
  expect(db.badge.create).not.toHaveBeenCalled();
});
it('creates point badges', async () => {
  db.badge.create.mockResolvedValue({ id: 'new', ...body });
  expect((await request(app).post('/badges').set('x-role', 'admin').send(body)).status).toBe(201);
  expect(db.badge.create).toHaveBeenCalledWith({ data: body });
});
it('protects system milestone rules', async () => {
  db.badge.findUnique.mockResolvedValue({ id: 'system', ...body, name: 'Giveaway Master', requiredPoints: 999999 });
  expect((await request(app).put('/badges/system').set('x-role', 'admin').send(body)).status).toBe(400);
  expect(db.badge.update).not.toHaveBeenCalled();
});
it('only deletes badges with no earned awards', async () => {
  db.badge.findUnique.mockResolvedValue({ id: 'earned', ...body });
  db.badge.deleteMany.mockResolvedValue({ count: 0 });
  expect((await request(app).delete('/badges/earned').set('x-role', 'admin')).status).toBe(409);
  expect(db.badge.deleteMany).toHaveBeenCalledWith({ where: { id: 'earned', users: { none: {} } } });
});
it('uploads badge images to dedicated storage', async () => {
  storage.uploadFile.mockResolvedValue('https://example.com/badges/image.png');
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+afoQAAAAASUVORK5CYII=', 'base64');
  const response = await request(app).post('/badges/upload').set('x-role', 'admin').attach('image', png, { filename: 'badge.png', contentType: 'image/png' });
  expect(response.status).toBe(201);
  expect(response.body.url).toBe('https://example.com/badges/image.png');
  expect(storage.uploadFile).toHaveBeenCalledWith(expect.stringMatching(/^badges\/.*\.png$/), expect.any(String), 'image/png');
});
it('rejects files disguised as images', async () => {
  const response = await request(app).post('/badges/upload').set('x-role', 'admin').attach('image', Buffer.from('not a real png image'), { filename: 'badge.png', contentType: 'image/png' });
  expect(response.status).toBe(400);
  expect(storage.uploadFile).not.toHaveBeenCalled();
});
it('rejects non-admin image uploads', async () => {
  expect((await request(app).post('/badges/upload').set('x-role', 'moderator')).status).toBe(403);
  expect(storage.uploadFile).not.toHaveBeenCalled();
});
