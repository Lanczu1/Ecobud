import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../prismaClient', () => ({ prisma: {
  swapListing: { findMany: vi.fn(), findFirst: vi.fn(), findUnique: vi.fn(), count: vi.fn(), update: vi.fn(), delete: vi.fn() },
  giveAndGetItem: { findMany: vi.fn(), findFirst: vi.fn(), update: vi.fn(), delete: vi.fn() },
  swapListingReport: { findMany: vi.fn(), count: vi.fn(), aggregate: vi.fn(), updateMany: vi.fn() },
  $transaction: vi.fn(),
} }));
vi.mock('../http/authentication', async importOriginal => {
  const actual = await importOriginal<typeof import('../http/authentication')>();
  return { ...actual, authenticateRequest: (req: any, res: any, next: any) => {
    const role = req.headers.authorization?.replace('Bearer ', '');
    if (!role) return res.sendStatus(401);
    req.auth = { userId: 'reviewer', role, city: req.headers['x-test-barangay'] };
    next();
  } };
});
vi.mock('../services/notificationService', () => ({ sendDirectNotification: vi.fn().mockResolvedValue(undefined) }));
vi.mock('../services/supabaseRealtimeService', () => ({ supabaseRealtimeService: {
  publishUserNotice: vi.fn().mockResolvedValue(undefined), publishSwapEvent: vi.fn().mockResolvedValue(undefined),
} }));
vi.mock('../services/swapReportService', () => ({
  submitSwapReport: vi.fn().mockResolvedValue({ ownerId: 'resident', listingId: 'local' }),
  swapReportSchema: { parse: (body: unknown) => body },
}));

import { prisma } from '../prismaClient';
import { submitSwapReport } from '../services/swapReportService';
import { errorResponder } from '../http/errorResponder';
import { giveAndGetResidentScope } from '../services/giveAndGetAccess';
import { BARANGAYS } from '../utils/announcementBarangays';
import routes from './giveAndGetRoutes';

const app = express();
app.use(express.json());
app.use('/give-and-get', routes);
app.use(errorResponder);

const listings = [
  { id: 'local', residentBarangay: 'Yukos', city: 'Abo', approvalStatus: 'pending' },
  { id: 'other', residentBarangay: 'Abo', city: 'Yukos', approvalStatus: 'pending' },
  { id: 'no-profile', residentBarangay: null, city: 'Yukos', approvalStatus: 'pending' },
].map(row => ({ ...row, userId: row.id, title: `${row.id} listing`, user: { name: row.id, email: `${row.id}@example.test` }, createdAt: new Date('2026-01-01'), status: 'pending' }));

function matching(where: any = {}) {
  return listings.filter(row => {
    const barangay = where.user?.profile?.city?.equals;
    return (!where.id || row.id === where.id)
      && (!barangay || row.residentBarangay?.toLowerCase() === barangay.toLowerCase())
      && (!where.approvalStatus || typeof where.approvalStatus !== 'string' || row.approvalStatus === where.approvalStatus);
  });
}
function asRole(method: 'get' | 'patch' | 'delete', url: string, role = 'moderator', city = 'Yukos') {
  return request(app)[method](`/give-and-get${url}`).set('Authorization', `Bearer ${role}`).set('x-test-barangay', city);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(prisma.swapListing.findMany).mockImplementation(async ({ where }: any) => matching(where) as any);
  vi.mocked(prisma.swapListing.findFirst).mockImplementation(async ({ where }: any) => matching(where)[0] as any ?? null);
  vi.mocked(prisma.swapListing.findUnique).mockImplementation(async ({ where }: any) => matching(where)[0] as any ?? null);
  vi.mocked(prisma.swapListing.count).mockImplementation(async ({ where }: any) => matching(where).length);
  vi.mocked(prisma.swapListing.update).mockImplementation(async ({ where, data }: any) => ({ ...matching(where)[0], ...data }) as any);
  vi.mocked(prisma.swapListing.delete).mockImplementation(async ({ where }: any) => matching(where)[0] as any);
  vi.mocked(prisma.giveAndGetItem.findMany).mockImplementation(async ({ where }: any) => matching(where) as any);
  vi.mocked(prisma.giveAndGetItem.findFirst).mockImplementation(async ({ where }: any) => matching(where)[0] as any ?? null);
  vi.mocked(prisma.$transaction).mockImplementation(async (callback: any) => callback(prisma));
  vi.mocked(prisma.swapListingReport.findMany).mockResolvedValue([]);
  vi.mocked(prisma.swapListingReport.count).mockResolvedValue(0);
  vi.mocked(prisma.swapListingReport.aggregate).mockResolvedValue({ _sum: { occurrences: 0 } } as any);
});

describe('Give & Get barangay access', () => {
  it.each(BARANGAYS)('uses resident profiles for the %s moderator scope', city => {
    expect(giveAndGetResidentScope({ role: 'moderator', city })).toEqual({ user: { profile: { city: { equals: city, mode: 'insensitive' } } } });
  });

  it('shows every resident to administrators', async () => {
    const response = await asRole('get', '/swap-listings', 'admin', '');
    expect(response.status).toBe(200);
    expect(response.body.items.map((item: any) => item.id)).toEqual(['local', 'other', 'no-profile']);
    expect(response.body.pagination.total).toBe(3);
    expect(response.body.scope.barangay).toBeNull();
  });

  it.each(['', '?status=pending', '?search=listing', '?barangay=Abo&city=Abo', '?recordId=local'])('scopes listings and totals by resident barangay: %s', async query => {
    const response = await asRole('get', `/swap-listings${query}`);
    expect(response.status).toBe(200);
    expect(response.body.items.map((item: any) => item.id)).toEqual(['local']);
    expect(response.body.pagination.total).toBe(1);
    expect(response.body.scope.barangay).toBe('Yukos');
    expect(prisma.swapListing.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining(giveAndGetResidentScope({ role: 'moderator', city: 'Yukos' })) }));
  });

  it('does not grant access through a listing meetup city or notification record ID', async () => {
    const response = await asRole('get', '/swap-listings?recordId=other');
    expect(response.body.items).toEqual([]);
    expect(response.body.pagination.total).toBe(0);
  });

  it('normalizes the assigned barangay', async () => {
    const response = await asRole('get', '/swap-listings', 'moderator', ' yukos ');
    expect(response.body.items.map((item: any) => item.id)).toEqual(['local']);
  });

  it.each(['moderator', 'admin'])('scopes statistics for %s', async role => {
    const response = await asRole('get', '/swap-listings/stats', role);
    expect(response.status).toBe(200);
    expect(response.body.total).toBe(role === 'admin' ? 3 : 1);
    expect(response.body.pending).toBe(role === 'admin' ? 3 : 1);
    for (const [args] of vi.mocked(prisma.swapListing.count).mock.calls) {
      expect(args?.where).toEqual(expect.objectContaining(giveAndGetResidentScope({ role: role as 'admin' | 'moderator', city: 'Yukos' })));
    }
  });

  const actions = [
    ['patch', '/swap-listings/other/approve'], ['patch', '/swap-listings/other/reject'],
    ['patch', '/swap-listings/other/report'], ['delete', '/swap-listings/other'],
    ['get', '/swap-listings/other/reports'], ['patch', '/other/status'], ['delete', '/other'],
  ] as const;
  it.each(actions)('blocks cross-barangay %s %s before any mutation or report access', async (method, url) => {
    const response = await asRole(method, url).send({ status: 'approved', reason: 'Review' });
    expect(response.status).toBe(404);
    expect(prisma.swapListing.update).not.toHaveBeenCalled();
    expect(prisma.swapListing.delete).not.toHaveBeenCalled();
    expect(prisma.giveAndGetItem.update).not.toHaveBeenCalled();
    expect(prisma.giveAndGetItem.delete).not.toHaveBeenCalled();
    expect(prisma.swapListingReport.findMany).not.toHaveBeenCalled();
    expect(submitSwapReport).not.toHaveBeenCalled();
  });

  it.each(['approve', 'reject'])('allows own-barangay %s', async action => {
    const response = await asRole('patch', `/swap-listings/local/${action}`).send({ reason: 'Review' });
    expect(response.status).toBe(200);
    expect(prisma.swapListing.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'local', ...giveAndGetResidentScope({ role: 'moderator', city: 'Yukos' }) } }));
  });

  it.each(actions)('allows administrators to use %s %s across barangays', async (method, url) => {
    const response = await asRole(method, url, 'admin', '').send({ status: 'approved', reason: 'Review' });
    expect(response.status).toBe(method === 'delete' ? 204 : 200);
  });

  it('scopes the older item list as well', async () => {
    const response = await asRole('get', '/');
    expect(response.status).toBe(200);
    expect(response.body.map((item: any) => item.id)).toEqual(['local']);
  });

  it.each(['', 'Unknown Barangay'])('denies unassigned or invalid moderator barangay: %s', async city => {
    expect((await asRole('get', '/swap-listings', 'moderator', city)).status).toBe(403);
    expect((await asRole('patch', '/swap-listings/local/approve', 'moderator', city)).status).toBe(403);
    expect(prisma.swapListing.findMany).not.toHaveBeenCalled();
    expect(prisma.swapListing.update).not.toHaveBeenCalled();
  });

  it('requires authentication and rejects regular users', async () => {
    expect((await request(app).get('/give-and-get/swap-listings')).status).toBe(401);
    expect((await asRole('get', '/swap-listings', 'user')).status).toBe(403);
  });
});
