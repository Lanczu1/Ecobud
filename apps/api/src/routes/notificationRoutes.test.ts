import express from 'express';
import request from 'supertest';
import { beforeEach, describe, it, expect, vi } from 'vitest';
const db = vi.hoisted(() => ({ notification: { findMany: vi.fn(), count: vi.fn(), findFirst: vi.fn(), updateMany: vi.fn() }, $executeRaw: vi.fn() }));
vi.mock('../prismaClient', () => ({ prisma: db }));
vi.mock('../http/authentication', () => ({ authenticateRequest: (req: any, res: any, next: any) => { if (req.headers.authorization !== 'Bearer alice')
        return res.sendStatus(401); req.auth = { userId: 'alice', sessionVersion: 0 }; next(); } }));
import { notificationRoutes } from './notificationRoutes';
import { errorResponder } from '../http/errorResponder';
const app = express();
app.use(express.json());
app.use('/notifications', notificationRoutes);
app.use(errorResponder);
beforeEach(() => { vi.clearAllMocks(); db.notification.findMany.mockResolvedValue([]); db.notification.count.mockResolvedValue(0); db.notification.updateMany.mockResolvedValue({ count: 0 }); });
describe('notification authorization', () => {
    it('requires authentication', async () => { await request(app).get('/notifications').expect(401); expect(db.notification.findMany).not.toHaveBeenCalled(); });
    it('scopes lists and unread counts to the authenticated user, ignoring injected ownership', async () => {
        await request(app).get('/notifications?userId=bob&type=event&unread=true').auth('alice', { type: 'bearer' }).expect(200);
        expect(db.notification.findMany.mock.calls[0][0].where).toEqual({ userId: 'alice', type: 'event', isRead: false });
        expect(db.notification.count.mock.calls[0][0].where).toEqual({ userId: 'alice', isRead: false });
    });
    it('prevents reading another owner notification', async () => { db.notification.findFirst.mockResolvedValue(null); await request(app).get('/notifications/bob-record').auth('alice', { type: 'bearer' }).expect(404); expect(db.notification.findFirst.mock.calls[0][0].where).toEqual({ id: 'bob-record', userId: 'alice' }); });
    it('prevents marking another owner record', async () => { await request(app).patch('/notifications/bob-record/read').auth('alice', { type: 'bearer' }).expect(404); expect(db.notification.updateMany.mock.calls[0][0].where).toEqual({ id: 'bob-record', userId: 'alice' }); });
    it('marks all only for the current user', async () => { await request(app).patch('/notifications/read-all').auth('alice', { type: 'bearer' }).send({ userId: 'bob' }).expect(200); expect(db.notification.updateMany.mock.calls[0][0].where).toEqual({ userId: 'alice', isRead: false }); });
    it('rejects malformed device tokens and filters', async () => { await request(app).post('/notifications/devices').auth('alice', { type: 'bearer' }).send({ token: 'invalid' }).expect(400); await request(app).get('/notifications?type=secret').auth('alice', { type: 'bearer' }).expect(400); expect(db.$executeRaw).not.toHaveBeenCalled(); });
});
