import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../http/authentication', () => ({
  authenticateRequest: (req: any, res: any, next: any) => {
    const role = req.headers.authorization?.replace('Bearer ', '');
    if (!role) return res.sendStatus(401);
    req.auth = { userId: 'viewer', role, city: 'Yukos' };
    next();
  },
  requireUserAccess: (_req: any, _res: any, next: any) => next(),
  requireModeratorAccess: (req: any, res: any, next: any) => ['admin', 'moderator'].includes(req.auth.role) ? next() : res.sendStatus(403),
}));
vi.mock('../services/eventPhotoDeletion', () => ({ requestEventPhotoDeletion: vi.fn(), listEventPhotoDeletionRequests: vi.fn(), approveEventPhotoDeletion: vi.fn() }));
vi.mock('../services/adminLiveEvents', () => ({ adminLiveEvents: { emit: vi.fn() } }));
vi.mock('../services/supabaseRealtimeService', () => ({ supabaseRealtimeService: { publishUserEventsRefresh: vi.fn() } }));

import { requestEventPhotoDeletion, listEventPhotoDeletionRequests, approveEventPhotoDeletion } from '../services/eventPhotoDeletion';
import { errorResponder } from '../http/errorResponder';
import { eventPhotoDeletionRoutes, adminEventPhotoDeletionRoutes } from './eventPhotoDeletionRoutes';
const app = express();
app.use(express.json());
app.use('/api/events', eventPhotoDeletionRoutes);
app.use('/api/admin/events/photo-delete-requests', adminEventPhotoDeletionRoutes);
app.use(errorResponder);

describe('photo delete request HTTP access and validation', () => {
  beforeEach(() => vi.resetAllMocks());

  it('requires authentication for requests and review', async () => {
    expect((await request(app).post('/api/events/submissions/one/delete-request').send({})).status).toBe(401);
    expect((await request(app).get('/api/admin/events/photo-delete-requests')).status).toBe(401);
  });

  it('requires a reason of 5 to 500 non-whitespace characters and a photo URL', async () => {
    for (const body of [{ reason: '    ', photoUrl: 'photo.jpg' }, { reason: 'abcd', photoUrl: 'photo.jpg' }, { reason: 'a'.repeat(501), photoUrl: 'photo.jpg' }, { reason: 'Private photo' }]) {
      expect((await request(app).post('/api/events/submissions/one/delete-request').set('Authorization', 'Bearer user').send(body)).status).toBe(400);
    }
    expect(requestEventPhotoDeletion).not.toHaveBeenCalled();
  });

  it('uses the authenticated user and trims the reason', async () => {
    vi.mocked(requestEventPhotoDeletion).mockResolvedValue({ id: 'request', status: 'pending', reason: 'Private photo' });
    const response = await request(app).post('/api/events/submissions/one/delete-request').set('Authorization', 'Bearer user').send({ userId: 'someone-else', reason: '  Private photo  ', photoUrl: 'photo.jpg' });
    expect(response.status).toBe(200);
    expect(requestEventPhotoDeletion).toHaveBeenCalledWith('viewer', 'one', 'Private photo', 'photo.jpg');
  });

  it('prevents regular users from listing or approving requests', async () => {
    expect((await request(app).get('/api/admin/events/photo-delete-requests').set('Authorization', 'Bearer user')).status).toBe(403);
    expect((await request(app).post('/api/admin/events/photo-delete-requests/request/approve').set('Authorization', 'Bearer user')).status).toBe(403);
    expect(approveEventPhotoDeletion).not.toHaveBeenCalled();
    expect(listEventPhotoDeletionRequests).not.toHaveBeenCalled();
  });

  it('passes moderator identity and pagination to scoped listing', async () => {
    vi.mocked(listEventPhotoDeletionRequests).mockResolvedValue({ items: [], pagination: { page: 2, pageSize: 20, total: 0, totalPages: 1 } });
    const response = await request(app).get('/api/admin/events/photo-delete-requests?status=approved&page=2&pageSize=20').set('Authorization', 'Bearer moderator');
    expect(response.status).toBe(200);
    expect(listEventPhotoDeletionRequests).toHaveBeenCalledWith({ userId: 'viewer', role: 'moderator', city: 'Yukos' }, 'approved', 2, 20);
  });

  it('allows approval by an admin and rejects invalid list status', async () => {
    vi.mocked(approveEventPhotoDeletion).mockResolvedValue({ userId: 'alice', eventId: 'event', alreadyApproved: false });
    expect((await request(app).post('/api/admin/events/photo-delete-requests/request/approve').set('Authorization', 'Bearer admin')).body).toEqual({ success: true, alreadyApproved: false });
    expect((await request(app).get('/api/admin/events/photo-delete-requests?status=unknown').set('Authorization', 'Bearer admin')).status).toBe(400);
  });
});
