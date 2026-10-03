import { beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';

const db = vi.hoisted(() => ({ swapListing: { findMany: vi.fn(), findUnique: vi.fn(), update: vi.fn(), updateMany: vi.fn() } }));
vi.mock('../prismaClient', () => ({ prisma: db }));
vi.mock('./notificationService', () => ({ sendDirectNotification: vi.fn() }));
vi.mock('./supabaseStorageService', () => ({ supabaseStorageService: {} }));
vi.mock('./supabaseRealtimeService', () => ({ supabaseRealtimeService: { publishUserNotice: vi.fn().mockResolvedValue(undefined), publishSwapEvent: vi.fn().mockResolvedValue(undefined) } }));
vi.mock('../http/authentication', () => ({
  authenticateRequest: (req: any, res: any, next: any) => {
    if (req.headers['x-anonymous']) return res.sendStatus(401);
    req.auth = { userId: req.headers['x-user'] || 'moderator', role: req.headers['x-role'] || 'moderator' }; next();
  },
  requireModeratorAccess: (req: any, res: any, next: any) => ['admin', 'moderator'].includes(req.auth.role) ? next() : res.sendStatus(403),
}));
import { swapService } from './swapService';
import giveAndGetRoutes from '../routes/giveAndGetRoutes';
import swapRoutes from '../routes/swapRoutes';
import { errorResponder } from '../http/errorResponder';

const app = express();
app.use(express.json());
app.use('/give-and-get', giveAndGetRoutes);
app.use('/swap', swapRoutes);
app.use(errorResponder);

type Row = { id: string; userId: string; isActive: boolean; approvalStatus: string; reportReason: string | null };
let rows: Row[];
function matches(row: Row, where: Record<string, any>): boolean {
  return Object.entries(where).every(([key, value]) => key === 'OR'
    ? value.some((branch: Record<string, any>) => matches(row, branch))
    : row[key as keyof Row] === value);
}
beforeEach(() => {
  vi.clearAllMocks();
  rows = [
    { id: 'approved', userId: 'owner', isActive: true, approvalStatus: 'approved', reportReason: null },
    { id: 'pending', userId: 'owner', isActive: true, approvalStatus: 'pending', reportReason: null },
    { id: 'rejected', userId: 'owner', isActive: false, approvalStatus: 'rejected', reportReason: 'Please upload a clear item photo.' },
    { id: 'removed', userId: 'owner', isActive: false, approvalStatus: 'approved', reportReason: null },
    { id: 'other', userId: 'another-owner', isActive: false, approvalStatus: 'rejected', reportReason: 'Different resident.' },
  ];
  db.swapListing.findMany.mockImplementation(async ({ where }) => rows.filter(row => matches(row, where)));
  db.swapListing.findUnique.mockImplementation(async ({ where }) => rows.find(row => row.id === where.id));
  db.swapListing.update.mockImplementation(async ({ where, data }) => {
    const row = rows.find(row => row.id === where.id)!;
    const reportCount = data.reportCount?.increment ? ((row as any).reportCount || 0) + data.reportCount.increment : data.reportCount;
    return Object.assign(row, data, reportCount !== undefined ? { reportCount } : {});
  });
  db.swapListing.updateMany.mockImplementation(async ({ where, data }) => {
    const matched = rows.filter(row => matches(row, where));
    for (const row of matched) Object.assign(row, data, { reportCount: ((row as any).reportCount || 0) + data.reportCount.increment });
    return { count: matched.length };
  });
});

describe('resident listing history', () => {
  it('saves a resident report while keeping the listing visible, then clears it on reapproval', async () => {
    await request(app).post('/swap/listings/approved/report').set('x-user', 'reporter').set('x-role', 'user').send({ reason: '  Misleading item photos  ' }).expect(201);
    expect(rows.find(row => row.id === 'approved')).toMatchObject({ isReported: true, reportCount: 1, reportReason: 'Misleading item photos', isActive: true, approvalStatus: 'approved' });
    expect((await swapService.fetchListings({})).map(row => row.id)).toContain('approved');
    await request(app).patch('/give-and-get/swap-listings/approved/approve').send({}).expect(200);
    expect(rows.find(row => row.id === 'approved')).toMatchObject({ isReported: false, reportCount: 0, reportReason: null, isActive: true });
  });
  it('rejects anonymous reports and resident moderation actions', async () => {
    await request(app).post('/swap/listings/approved/report').set('x-anonymous', 'true').send({ reason: 'Fake item' }).expect(401);
    for (const action of ['approve', 'reject', 'report']) {
      await request(app).patch(`/give-and-get/swap-listings/approved/${action}`).set('x-role', 'user').send({ reason: 'Fake item' }).expect(403);
    }
    expect(db.swapListing.update).not.toHaveBeenCalled();
    expect(db.swapListing.updateMany).not.toHaveBeenCalled();
  });
  it('rejects invalid reasons, own listings and unavailable listings without saving reports', async () => {
    await request(app).post('/swap/listings/approved/report').set('x-user', 'invalid-reason').send({ reason: ' ' }).expect(400);
    await request(app).post('/swap/listings/approved/report').set('x-user', 'invalid-reason').send({ reason: 'a'.repeat(501) }).expect(400);
    await request(app).post('/swap/listings/approved/report').set('x-user', 'owner').send({ reason: 'Fake item' }).expect(400);
    for (const id of ['pending', 'rejected', 'removed', 'missing']) {
      await request(app).post(`/swap/listings/${id}/report`).set('x-user', `reporter-${id}`).send({ reason: 'Fake item' }).expect(404);
    }
    expect(db.swapListing.update).not.toHaveBeenCalled();
    expect(db.swapListing.updateMany).not.toHaveBeenCalled();
  });
  it('limits repeated resident reports', async () => {
    for (let i = 0; i < 5; i++) {
      await request(app).post('/swap/listings/approved/report').set('x-user', 'repeated-reporter').send({ reason: 'Fake item photos' }).expect(201);
    }
    await request(app).post('/swap/listings/approved/report').set('x-user', 'repeated-reporter').send({ reason: 'Fake item photos' }).expect(429);
    expect(db.swapListing.updateMany).toHaveBeenCalledTimes(5);
  });
  it('lets a moderator flag, reject and reapprove a listing through the same review flow', async () => {
    await request(app).patch('/give-and-get/swap-listings/approved/report').send({ reason: 'Misleading item description' }).expect(200);
    expect(rows.find(row => row.id === 'approved')).toMatchObject({ isReported: true, reportCount: 1 });
    await request(app).patch('/give-and-get/swap-listings/approved/reject').send({ reason: 'Please upload genuine item photos.' }).expect(200);
    expect((await swapService.fetchListings({})).map(row => row.id)).not.toContain('approved');
    expect((await swapService.fetchMyListings('owner')).find(row => row.id === 'approved')).toMatchObject({ rejectionReason: 'Please upload genuine item photos.' });
    await request(app).patch('/give-and-get/swap-listings/approved/approve').send({}).expect(200);
    expect((await swapService.fetchListings({})).map(row => row.id)).toContain('approved');
    expect(rows.find(row => row.id === 'approved')).toMatchObject({ isReported: false, reportCount: 0, reportReason: null });
  });
  it('restores a rejected listing to Browse and My Listings after moderator reapproval', async () => {
    await request(app).patch('/give-and-get/swap-listings/rejected/approve').send({}).expect(200);
    const feed = await swapService.fetchListings({});
    const history = await swapService.fetchMyListings('owner');
    for (const listings of [feed, history]) {
      expect(listings.find(row => row.id === 'rejected')).toMatchObject({ approvalStatus: 'approved', isActive: true, rejectionReason: null });
    }
  });
  it('keeps inactive rejected listings with their real moderation reason alongside active listings', async () => {
    const result = await swapService.fetchMyListings('owner');
    expect(result.map(row => row.id)).toEqual(['approved', 'pending', 'rejected']);
    expect(result.find(row => row.id === 'rejected')).toMatchObject({ approvalStatus: 'rejected', isActive: false, rejectionReason: 'Please upload a clear item photo.' });
  });
  it('does not expose rejected or pending listings in the public feed', async () => {
    expect((await swapService.fetchListings({})).map(row => row.id)).toEqual(['approved']);
  });
  it('does not return another resident’s rejected listings', async () => {
    expect((await swapService.fetchMyListings('another-owner')).map(row => row.id)).toEqual(['other']);
  });
  it('keeps an explicitly deleted rejected listing out of My Listings', async () => {
    await swapService.deleteListing('rejected', 'owner', 'user');
    expect((await swapService.fetchMyListings('owner')).map(row => row.id)).toEqual(['approved', 'pending']);
  });
  it('preserves approval history when an approved listing is deleted', async () => {
    await swapService.deleteListing('approved', 'owner', 'user');
    expect(rows.find(row => row.id === 'approved')).toMatchObject({ approvalStatus: 'approved', isActive: false });
    expect((await swapService.fetchMyListings('owner')).map(row => row.id)).toEqual(['pending', 'rejected']);
  });
  it('does not let another resident remove a rejected listing', async () => {
    await expect(swapService.deleteListing('rejected', 'another-owner', 'user')).rejects.toThrow('permission');
    expect(db.swapListing.update).not.toHaveBeenCalled();
  });
});
