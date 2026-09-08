import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../prismaClient';
import { authenticateRequest, AuthenticatedRequest } from '../http/authentication';
import { errorBoundary, HttpError } from '../http/errorResponder';
export const notificationRoutes = Router();
export const notificationTypes = ['challenge', 'verification', 'swap', 'chat', 'event', 'reward', 'learning', 'streak', 'leaderboard', 'system'] as const;
notificationRoutes.use(authenticateRequest);
notificationRoutes.get('/', errorBoundary(async (req: AuthenticatedRequest, res) => {
    const q = z.object({ type: z.enum(notificationTypes).optional(), unread: z.enum(['true', 'false']).optional(), offset: z.coerce.number().int().min(0).max(100000).default(0) }).parse(req.query);
    const where = { userId: req.auth!.userId, ...(q.type ? { type: q.type } : {}), ...(q.unread === 'true' ? { isRead: false } : {}) };
    const [items, unreadCount] = await Promise.all([prisma.notification.findMany({ where, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], skip: q.offset, take: 50 }), prisma.notification.count({ where: { userId: req.auth!.userId, isRead: false } })]);
    res.json({ items, unreadCount, nextOffset: items.length === 50 ? q.offset + 50 : null });
}));
notificationRoutes.patch('/read-all', errorBoundary(async (req: AuthenticatedRequest, res) => {
    await prisma.notification.updateMany({ where: { userId: req.auth!.userId, isRead: false }, data: { isRead: true, readAt: new Date() } });
    res.json({ success: true });
}));
notificationRoutes.patch('/:id/read', errorBoundary(async (req: AuthenticatedRequest, res) => {
    const result = await prisma.notification.updateMany({ where: { id: req.params.id, userId: req.auth!.userId }, data: { isRead: true, readAt: new Date() } });
    if (!result.count)
        throw new HttpError(404, 'Notification not found.');
    res.json({ success: true });
}));
const device = z.object({ token: z.string().max(250).regex(/^(ExponentPushToken|ExpoPushToken)\[[A-Za-z0-9_-]+\]$/) });
notificationRoutes.post('/devices', errorBoundary(async (req: AuthenticatedRequest, res) => {
    const { token } = device.parse(req.body);
    const u = req.auth!;
    await prisma.$executeRaw `INSERT INTO notification_devices(token,user_id,session_version) VALUES(${token},${u.userId},${u.sessionVersion}) ON CONFLICT(token) DO UPDATE SET user_id=EXCLUDED.user_id,session_version=EXCLUDED.session_version,updated_at=CURRENT_TIMESTAMP`;
    res.json({ success: true });
}));
notificationRoutes.delete('/devices', errorBoundary(async (req: AuthenticatedRequest, res) => {
    const { token } = device.parse(req.body);
    await prisma.$executeRaw `DELETE FROM notification_devices WHERE token=${token} AND user_id=${req.auth!.userId}`;
    res.json({ success: true });
}));
notificationRoutes.get('/:id', errorBoundary(async (req: AuthenticatedRequest, res) => {
    const item = await prisma.notification.findFirst({ where: { id: req.params.id, userId: req.auth!.userId } });
    if (!item)
        throw new HttpError(404, 'Notification not found.');
    res.json(item);
}));
