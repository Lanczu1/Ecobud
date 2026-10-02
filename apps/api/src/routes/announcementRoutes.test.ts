import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
const db = vi.hoisted(() => ({ announcement: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() }, profile: { findMany: vi.fn() }, challenge: {}, event: {}, lesson: {}, redeemItem: {} }));
vi.mock('../prismaClient', () => ({ prisma: db }));
vi.mock('../services/notificationService', () => ({ notificationTick: vi.fn() }));
vi.mock('../http/uploadMiddleware', () => ({ challengeUploadMiddleware: { single: () => (_req: any, _res: any, next: any) => next() } }));
vi.mock('../controllers/adminController', () => ({ AdminController: { uploadImage: (_req: any, res: any) => res.json({ url: 'https://example.com/image.png' }) } }));
vi.mock('../http/authentication', () => ({
  authenticateRequest: (req: any, res: any, next: any) => { const role = req.headers.authorization?.replace('Bearer ', ''); if (!role) return res.sendStatus(401); req.auth = { role, userId: 'real-author', city: req.headers['x-city'] ?? 'Yukos' }; next(); },
  requireAdminAccess: (req: any, res: any, next: any) => req.auth.role === 'admin' ? next() : res.sendStatus(403),
  requireModeratorAccess: (req: any, res: any, next: any) => ['admin', 'moderator'].includes(req.auth.role) ? next() : res.sendStatus(403),
}));
import { announcementAdminRoutes, announcementResidentRoutes } from './announcementRoutes';
import { errorResponder } from '../http/errorResponder';
import { notificationTick } from '../services/notificationService';
import { announcementSchema, effectiveAnnouncementStatus } from '../services/announcementRules';
const app = express(); app.use(express.json()); app.use('/admin', announcementAdminRoutes); app.use('/resident', announcementResidentRoutes); app.use(errorResponder);
const payload = { title: 'Test announcement', content: 'Test content', category: 'General', status: 'Draft', priority: 'Normal', targetAudience: 'All Residents', barangays: [], publishAt: null, expiresAt: null, ctaLabel: null, ctaType: 'No Action', ctaValue: null };
beforeEach(() => { vi.resetAllMocks(); db.announcement.findMany.mockResolvedValue([]); db.announcement.create.mockResolvedValue({ id: 'new' }); });
describe('announcement permissions and lifecycle', () => {
  it('rejects anonymous requests and all non-admin mutations', async () => {
    await request(app).get('/admin').expect(401);
    for (const role of ['user']) {
      await request(app).post('/admin').auth(role, { type: 'bearer' }).send(payload).expect(403);
      await request(app).put('/admin/a').auth(role, { type: 'bearer' }).send(payload).expect(403);
      await request(app).delete('/admin/a').auth(role, { type: 'bearer' }).expect(403);
      await request(app).post('/admin/upload').auth(role, { type: 'bearer' }).expect(403);
    }
    expect(db.announcement.create).not.toHaveBeenCalled();
  });
  it('assigns the authenticated author, ignoring injected ownership', async () => {
    await request(app).post('/admin').auth('admin', { type: 'bearer' }).send({ ...payload, createdById: 'attacker' }).expect(201);
    expect(db.announcement.create.mock.calls[0][0].data.createdById).toBe('real-author');
  });
  it('requires a second confirmation for published deletion', async () => {
    db.announcement.findUnique.mockResolvedValue({ id: 'a', status: 'Published', publishAt: new Date(), expiresAt: null });
    await request(app).delete('/admin/a').auth('admin', { type: 'bearer' }).expect(409);
    expect(db.announcement.delete).not.toHaveBeenCalled();
    await request(app).delete('/admin/a?confirmPublished=true').auth('admin', { type: 'bearer' }).expect(204);
  });
  it('scopes resident reads to their authenticated barangay and eligible dates', async () => {
    await request(app).get('/resident?barangay=Another').auth('user', { type: 'bearer' }).expect(200);
    const where = db.announcement.findMany.mock.calls[0][0].where;
    expect(where.AND[1].OR[1].barangays.has).toBe('Yukos');
    expect(where.AND[1].OR[0]).toEqual({ targetAudience: 'All Residents' });
    expect(where.AND[1].OR[1].targetAudience.in).toEqual(['Specific Barangay', 'Multiple Barangays']);
    expect(where.OR).toEqual([{ status: 'Published' }, { status: 'Scheduled', publishAt: { lte: expect.any(Date) } }]);
    expect(where.AND[0].OR[1].expiresAt.gt).toBeInstanceOf(Date);
  });
  it('starts push processing immediately after publication but not for drafts', async () => {
    await request(app).post('/admin').auth('admin', { type: 'bearer' }).send(payload).expect(201);
    expect(notificationTick).not.toHaveBeenCalled();
    await request(app).post('/admin').auth('admin', { type: 'bearer' }).send({ ...payload, status: 'Published' }).expect(201);
    expect(notificationTick).toHaveBeenCalledOnce();
  });
  it('fetches a notification destination by ID with the same audience and expiration checks', async () => {
    await request(app).get('/resident?id=target').auth('user', { type: 'bearer' }).expect(200);
    expect(db.announcement.findMany.mock.calls[0][0].where).toMatchObject({
      id: 'target', AND: [{ OR: [{ expiresAt: null }, { expiresAt: { gt: expect.any(Date) } }] }, { OR: expect.any(Array) }],
    });
  });
  it('uses the resident barangay regardless of author or requested barangay', async () => {
    await request(app).get('/resident?barangay=Yukos').auth('user', { type: 'bearer' }).set('x-city', ' abo ').expect(200);
    const audience = db.announcement.findMany.mock.calls[0][0].where.AND[1].OR;
    expect(audience).toEqual([
      { targetAudience: 'All Residents' },
      { targetAudience: { in: ['Specific Barangay', 'Multiple Barangays'] }, barangays: { has: 'Abo' } },
    ]);
    expect(db.announcement.findMany.mock.calls[0][0].where.createdById).toBeUndefined();
  });
  it('only returns announcements for all residents when the barangay is missing or invalid', async () => {
    for (const city of ['', 'Unknown Barangay']) {
      await request(app).get('/resident?barangay=Yukos').auth('user', { type: 'bearer' }).set('x-city', city).expect(200);
      const query = db.announcement.findMany.mock.calls.at(-1)![0];
      expect(query.where.AND[1].OR).toEqual([{ targetAudience: 'All Residents' }]);
    }
  });
  it('rejects past schedules, invalid audience and unsafe CTA links', () => {
    expect(announcementSchema.safeParse({ ...payload, status: 'Scheduled', publishAt: '2020-01-01T00:00:00Z' }).success).toBe(false);
    expect(announcementSchema.safeParse({ ...payload, targetAudience: 'Specific Barangay' }).success).toBe(false);
    expect(announcementSchema.safeParse({ ...payload, ctaType: 'Open External Link', ctaLabel: 'Open', ctaValue: 'javascript:alert(1)' }).success).toBe(false);
  });
  it('publishes at the exact due time and expires without needing a worker', () => {
    const now = new Date('2026-10-02T10:00:00Z');
    expect(effectiveAnnouncementStatus({ status: 'Scheduled', publishAt: now, expiresAt: null }, now)).toBe('Published');
    expect(effectiveAnnouncementStatus({ status: 'Published', publishAt: null, expiresAt: now }, now)).toBe('Archived');
    expect(effectiveAnnouncementStatus({ status: 'Draft', publishAt: now, expiresAt: now }, now)).toBe('Draft');
  });
  it('allows moderator creation only for the assigned barangay', async () => {
    await request(app).post('/admin').auth('moderator', { type: 'bearer' }).send(payload).expect(403);
    await request(app).post('/admin').auth('moderator', { type: 'bearer' }).send({ ...payload, targetAudience: 'Specific Barangay', barangays: ['Yukos'], images: ['https://example.com/a.png', 'https://example.com/b.png'] }).expect(201);
    expect(db.announcement.create.mock.calls[0][0].data.images).toHaveLength(2);
    expect(db.announcement.create.mock.calls[0][0].data.image).toBe('https://example.com/a.png');
    await request(app).post('/admin').auth('moderator', { type: 'bearer' }).send({ ...payload, targetAudience: 'Specific Barangay', barangays: ['Abo'] }).expect(403);
  });
  it('blocks moderator edits, gallery updates and deletes of admin and other moderator posts', async () => {
    for (const item of [
      { createdById: 'admin', createdBy: { role: 'admin' }, barangays: ['Yukos'] },
      { createdById: 'another-mod', createdBy: { role: 'moderator' }, barangays: ['Yukos'] },
      { createdById: 'real-author', createdBy: { role: 'moderator' }, barangays: ['Abo'] },
    ]) {
      db.announcement.findUnique.mockResolvedValue({ ...payload, ...item, id: 'a', targetAudience: 'Specific Barangay' });
      await request(app).put('/admin/a').auth('moderator', { type: 'bearer' }).send(payload).expect(403);
      await request(app).patch('/admin/a/images').auth('moderator', { type: 'bearer' }).send({ images: [] }).expect(403);
      await request(app).delete('/admin/a').auth('moderator', { type: 'bearer' }).expect(403);
    }
    expect(db.announcement.update).not.toHaveBeenCalled();
    expect(db.announcement.delete).not.toHaveBeenCalled();
  });
  it('allows own moderator updates but rejects audience changes and injected gallery fields', async () => {
    db.announcement.findUnique.mockResolvedValue({ ...payload, id: 'a', createdById: 'real-author', createdBy: { role: 'moderator' }, targetAudience: 'Specific Barangay', barangays: ['Yukos'] });
    await request(app).put('/admin/a').auth('moderator', { type: 'bearer' }).send({ ...payload, targetAudience: 'Specific Barangay', barangays: ['Yukos'] }).expect(200);
    await request(app).put('/admin/a').auth('moderator', { type: 'bearer' }).send({ ...payload, targetAudience: 'Specific Barangay', barangays: ['Abo'] }).expect(403);
    await request(app).patch('/admin/a/images').auth('moderator', { type: 'bearer' }).send({ images: ['https://example.com/photo.png'] }).expect(200);
    await request(app).patch('/admin/a/images').auth('moderator', { type: 'bearer' }).send({ images: [], title: 'Injected' }).expect(400);
    expect(db.announcement.update.mock.calls.at(-1)?.[0].data).toEqual({ images: ['https://example.com/photo.png'], image: 'https://example.com/photo.png' });
  });
  it('returns all 52 existing barangays and fails closed without an assignment', async () => {
    const response = await request(app).get('/admin/barangays').auth('moderator', { type: 'bearer' }).expect(200);
    expect(response.body.items).toHaveLength(52); expect(response.body.assignedBarangay).toBe('Yukos');
    await request(app).post('/admin/upload').auth('moderator', { type: 'bearer' }).set('x-city', '').expect(403);
    await request(app).post('/admin/upload').auth('moderator', { type: 'bearer' }).expect(200);
    expect(announcementSchema.safeParse({ ...payload, images: Array(11).fill('https://example.com/a.png') }).success).toBe(false);
    expect(announcementSchema.safeParse({ ...payload, images: ['javascript:alert(1)'] }).success).toBe(false);
  });
});
