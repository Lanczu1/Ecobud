import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../prismaClient', () => ({ prisma: { eventSubmission: { findMany: vi.fn() }, auditLog: { findMany: vi.fn() } } }));
vi.mock('../http/authentication', () => ({
  authenticateRequest: (req: any, res: any, next: any) => {
    const userId = req.headers.authorization?.replace('Bearer ', '');
    if (!userId) return res.sendStatus(401);
    req.auth = { userId, role: 'user' };
    next();
  },
  requireUserAccess: (_req: any, _res: any, next: any) => next(),
  requireModeratorAccess: (_req: any, _res: any, next: any) => next(),
  cachedSessionUser: vi.fn(),
}));
vi.mock('../http/idVerificationAccess', () => ({ requireApprovedId: vi.fn() }));
vi.mock('../http/uploadMiddleware', () => ({ eventSubmissionUploadMiddleware: { single: () => vi.fn() } }));
vi.mock('../services/supabaseStorageService', () => ({ supabaseStorageService: {} }));
vi.mock('../services/GamificationService', () => ({ GamificationService: class {} }));
vi.mock('../services/supabaseRealtimeService', () => ({ supabaseRealtimeService: {} }));
vi.mock('../services/notificationService', () => ({ sendDirectNotification: vi.fn() }));

import { prisma } from '../prismaClient';
import { encodeCursor } from '../http/cursorPagination';
import { errorResponder } from '../http/errorResponder';
import { eventRoutes } from './eventRoutes';

const app = express();
app.use('/api/events', eventRoutes);
app.use(errorResponder);

const submission = (id: string, status = 'approved') => ({
  id, eventId: `event-${id}`, status, rejectionReason: null,
  attendanceImageUrl: `https://example.test/attendance/${id}.jpg`,
  submittedAt: new Date('2026-10-15T10:00:00Z'), reviewedAt: null,
  event: { title: `Event ${id}`, location: 'Nagcarlan' },
});

describe('GET /api/events/history', () => {
  beforeEach(() => {
    vi.mocked(prisma.eventSubmission.findMany).mockReset();
    vi.mocked(prisma.auditLog.findMany).mockReset().mockResolvedValue([]);
  });

  it('requires a signed-in user before reading submissions', async () => {
    expect((await request(app).get('/api/events/history')).status).toBe(401);
    expect(prisma.eventSubmission.findMany).not.toHaveBeenCalled();
  });

  it('scopes every request to the signed-in user, ignoring a supplied user ID', async () => {
    for (const userId of ['alice', 'bob']) {
      vi.mocked(prisma.eventSubmission.findMany).mockResolvedValueOnce([submission(userId)] as any);
      const response = await request(app).get('/api/events/history?userId=someone-else').set('Authorization', `Bearer ${userId}`);
      expect(response.status).toBe(200);
      expect(response.body.items.map((item: any) => item.id)).toEqual([userId]);
      expect(response.body.items[0].attendanceImageUrl).toBe(`https://example.test/attendance/${userId}.jpg`);
      expect(prisma.eventSubmission.findMany).toHaveBeenLastCalledWith(expect.objectContaining({ where: { userId } }));
    }
  });

  it('returns all submission statuses and the event details, newest first', async () => {
    vi.mocked(prisma.eventSubmission.findMany).mockResolvedValueOnce([
      submission('3', 'pending'), submission('2', 'rejected'), submission('1'),
    ] as any);
    const response = await request(app).get('/api/events/history').set('Authorization', 'Bearer alice');
    expect(response.status).toBe(200);
    expect(response.body.items.map((item: any) => item.status)).toEqual(['pending', 'rejected', 'approved']);
    expect(response.body.items[0].event.title).toBe('Event 3');
    expect(prisma.eventSubmission.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { userId: 'alice' }, orderBy: [{ submittedAt: 'desc' }, { id: 'desc' }],
      select: expect.objectContaining({ attendanceImageUrl: true }),
    }));
  });

  it('paginates tied submission dates without dropping the user filter', async () => {
    vi.mocked(prisma.eventSubmission.findMany).mockResolvedValueOnce([submission('3'), submission('2'), submission('1')] as any);
    const first = await request(app).get('/api/events/history?limit=2').set('Authorization', 'Bearer alice');
    expect(first.body.items.map((item: any) => item.id)).toEqual(['3', '2']);
    expect(first.body.nextCursor).toBe(encodeCursor({ id: '2', at: '2026-10-15T10:00:00.000Z' }));
    vi.mocked(prisma.eventSubmission.findMany).mockResolvedValueOnce([submission('1')] as any);
    const second = await request(app).get('/api/events/history').query({ limit: 2, cursor: first.body.nextCursor }).set('Authorization', 'Bearer alice');
    expect(second.body.nextCursor).toBeNull();
    expect(prisma.eventSubmission.findMany).toHaveBeenLastCalledWith(expect.objectContaining({
      where: { userId: 'alice', OR: [
        { submittedAt: { lt: new Date('2026-10-15T10:00:00Z') } },
        { submittedAt: new Date('2026-10-15T10:00:00Z'), id: { lt: '2' } },
      ] }, take: 3,
    }));
  });

  it('returns an empty page when the user has no submissions', async () => {
    vi.mocked(prisma.eventSubmission.findMany).mockResolvedValueOnce([]);
    const response = await request(app).get('/api/events/history').set('Authorization', 'Bearer alice');
    expect(response.body).toEqual({ items: [], nextCursor: null });
  });

  it('rejects malformed pagination without querying', async () => {
    for (const query of ['cursor=invalid!', 'limit=0']) {
      expect((await request(app).get(`/api/events/history?${query}`).set('Authorization', 'Bearer alice')).status).toBe(400);
    }
    expect(prisma.eventSubmission.findMany).not.toHaveBeenCalled();
  });

  it('keeps history details after photo approval and scopes request statuses to the user', async () => {
    vi.mocked(prisma.eventSubmission.findMany).mockResolvedValueOnce([{ ...submission('one'), attendanceImageUrl: '' }] as any);
    vi.mocked(prisma.auditLog.findMany).mockResolvedValueOnce([{
      id: 'event-photo-delete:one:abc123', action: 'EVENT_PHOTO_DELETE_APPROVED',
      details: JSON.stringify({ submissionId: 'one', eventId: 'event-one', eventTitle: 'Event one', photoUrl: 'photo.jpg', reason: 'Private photo' }),
    }] as any);
    const response = await request(app).get('/api/events/history').set('Authorization', 'Bearer alice');
    expect(response.body.items[0]).toMatchObject({ id: 'one', attendanceImageUrl: '', event: { title: 'Event one' }, deletionRequest: { status: 'approved', reason: 'Private photo' } });
    expect(prisma.auditLog.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: 'alice', action: { in: ['EVENT_PHOTO_DELETE_PENDING', 'EVENT_PHOTO_DELETE_APPROVED'] } } }));
  });

  it('does not attach another submission\'s photo request', async () => {
    vi.mocked(prisma.eventSubmission.findMany).mockResolvedValueOnce([{ ...submission('one'), attendanceImageUrl: '' }] as any);
    vi.mocked(prisma.auditLog.findMany).mockResolvedValueOnce([{
      id: 'event-photo-delete:other:abc123', action: 'EVENT_PHOTO_DELETE_APPROVED',
      details: JSON.stringify({ submissionId: 'other', eventId: 'event-other', eventTitle: 'Other', photoUrl: 'photo.jpg', reason: 'Private photo' }),
    }] as any);
    const response = await request(app).get('/api/events/history').set('Authorization', 'Bearer alice');
    expect(response.body.items[0].deletionRequest).toBeNull();
  });
});
