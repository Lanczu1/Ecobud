import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => ({ event: { findUnique: vi.fn() } }));
vi.mock('../prismaClient', () => ({ prisma: db }));
import { authorizeEventWrite, validateEventAudience, canManageEvent, eventBarangay } from './eventAccess';
import { BARANGAYS } from '../utils/announcementBarangays';

const moderator = { role: 'moderator', userId: 'yukos-mod', city: 'Yukos' };
const own = { managedById: 'yukos-mod', barangay: 'Yukos', managedBy: { role: 'moderator' } };
const app = express();
app.use(express.json(), (req: any, _res, next) => {
  req.auth = req.headers['x-role'] === 'admin' ? { ...moderator, role: 'admin' } : moderator;
  next();
});
app.post('/events', authorizeEventWrite, validateEventAudience, (req, res) => res.json(req.body));
app.put('/events/:id', authorizeEventWrite, validateEventAudience, (req, res) => res.json(req.body));
app.delete('/events/:id', authorizeEventWrite, (_req, res) => res.sendStatus(204));
app.post('/events/:id/qr', authorizeEventWrite, (_req, res) => res.sendStatus(201));
app.get('/events/:id/qr', authorizeEventWrite, (_req, res) => res.sendStatus(200));

describe('Eco Event barangay and ownership restrictions', () => {
  beforeEach(() => { vi.clearAllMocks(); db.event.findUnique.mockResolvedValue(own); });
  it('uses all 52 barangays and normalizes assigned cities', () => {
    expect(BARANGAYS).toHaveLength(52);
    expect(eventBarangay(' yukos ')).toBe('Yukos');
    expect(eventBarangay('Unknown')).toBeNull();
  });
  it('allows only the owner in the assigned barangay, while admins can manage any event', () => {
    expect(canManageEvent(moderator, own)).toBe(true);
    for (const event of [
      { ...own, managedById: 'other-mod' },
      { ...own, barangay: 'Abo' },
      { ...own, managedBy: { role: 'admin' } },
      { ...own, barangay: null },
    ]) {
      expect(canManageEvent(moderator, event)).toBe(false);
      expect(canManageEvent({ ...moderator, role: 'admin' }, event)).toBe(true);
    }
    expect(canManageEvent({ ...moderator, city: null }, own)).toBe(false);
  });
  it('forces moderator creation to their barangay and rejects a different audience', async () => {
    const result = await request(app).post('/events').send({ title: 'Cleanup', managedById: 'admin', id: 'injected' }).expect(200);
    expect(result.body).toEqual({ title: 'Cleanup', barangay: 'Yukos' });
    await request(app).post('/events').send({ barangay: 'Abo' }).expect(403);
    await request(app).post('/events').send({ barangay: 'Unknown' }).expect(400);
    await request(app).post('/events').send({ targetAudience: 'Invalid audience' }).expect(400);
    for (const targetAudience of ['Residents', 'SK', 'Barangay Officials', 'Others']) {
      const audienceResult = await request(app).post('/events').send({ targetAudience }).expect(200);
      expect(audienceResult.body).toEqual({ barangay: 'Yukos', targetAudience });
    }
    await request(app).post('/events').set('x-role', 'admin').send({ barangay: '' }).expect(200, { barangay: null });
  });
  it('blocks direct edit, delete, feature and QR writes on other authors', async () => {
    db.event.findUnique.mockResolvedValue({ ...own, managedById: 'admin', managedBy: { role: 'admin' } });
    await request(app).put('/events/e').send({ isFeatured: true }).expect(403);
    await request(app).delete('/events/e').expect(403);
    await request(app).post('/events/e/qr').expect(403);
    db.event.findUnique.mockResolvedValue({ ...own, managedById: 'other-mod' });
    await request(app).put('/events/e').send({ title: 'Changed' }).expect(403);
  });
  it('allows owner updates without allowing ownership reassignment', async () => {
    const result = await request(app).put('/events/e').send({ title: 'Updated', managedById: 'other' }).expect(200);
    expect(result.body).toEqual({ title: 'Updated', barangay: 'Yukos' });
    db.event.findUnique.mockResolvedValue(null);
    await request(app).delete('/events/missing').expect(404);
  });
  it('reserves featuring for admins even on moderator-owned events', async () => {
    await request(app).post('/events').send({ isFeatured: true }).expect(403);
    await request(app).put('/events/e').send({ isFeatured: false }).expect(403);
    await request(app).put('/events/e').set('x-role', 'admin').send({ isFeatured: true }).expect(200);
  });
  it('restricts QR reads to the owner or an admin', async () => {
    await request(app).get('/events/e/qr').expect(200);
    db.event.findUnique.mockResolvedValue({ ...own, managedById: 'other-mod' });
    await request(app).get('/events/e/qr').expect(403);
    await request(app).get('/events/e/qr').set('x-role', 'admin').expect(200);
  });
});
