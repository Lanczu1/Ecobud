import { beforeEach, describe, it, expect, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ db: { notification: { findUnique: vi.fn() }, $queryRaw: vi.fn(), $executeRaw: vi.fn() }, sendMail: vi.fn(), notice: vi.fn(), sendPush: vi.fn() }));
vi.mock('../prismaClient', () => ({ prisma: mocks.db }));
vi.mock('nodemailer', () => ({ default: { createTransport: () => ({ sendMail: mocks.sendMail }) } }));
vi.mock('./supabaseRealtimeService', () => ({ supabaseRealtimeService: { publishUserNotice: mocks.notice } }));
vi.mock('../lib/firebaseMessaging', () => ({ firebaseMessaging: { send: mocks.sendPush } }));
import { deliverNotification } from './notificationService';
const job = { id: 'delivery', notification_id: 'n', channel: 'push', destination: 'fcm-registration-token', attempts: 1, receipt: null };
beforeEach(() => { vi.clearAllMocks(); mocks.db.notification.findUnique.mockResolvedValue({ id: 'n', userId: 'alice', title: 'New Learn', message: 'A module is available', priority: 'low', user: { status: 'active', sessionVersion: 0, email: 'alice@example.com' } }); mocks.db.$queryRaw.mockResolvedValue([{ token: job.destination }]); mocks.sendPush.mockResolvedValue('projects/ecobud/messages/message-id'); });
describe('push delivery isolation', () => {
    it('deactivates an invalid token without removing the in-app notification', async () => { mocks.sendPush.mockRejectedValue(Object.assign(new Error('invalid'), { code: 'messaging/registration-token-not-registered' })); expect(await deliverNotification(job)).toBe('failed'); expect(String(mocks.db.$executeRaw.mock.calls[0][0])).toContain('DELETE FROM notification_devices'); });
    it('saves the Firebase message ID after an accepted send', async () => { expect(await deliverNotification(job)).toBe('sent'); expect(mocks.db.$executeRaw.mock.calls[0]).toContain('projects/ecobud/messages/message-id'); });
    it('never sends to suspended accounts or revoked devices', async () => { mocks.db.$queryRaw.mockResolvedValue([]); expect(await deliverNotification(job)).toBe('cancelled'); expect(mocks.sendPush).not.toHaveBeenCalled(); });
    it('marks Firebase throttling as safe to retry', async () => { mocks.sendPush.mockRejectedValue(Object.assign(new Error('quota'), { code: 'messaging/quota-exceeded' })); await expect(deliverNotification(job)).rejects.toMatchObject({ retrySafe: true }); });
    it('does not expose account data in push payloads', async () => { await deliverNotification(job); expect(mocks.sendPush).toHaveBeenCalledWith({ token: job.destination, title: 'New Learn', body: 'A module is available', notificationId: 'n', priority: 'low' }); expect(JSON.stringify(mocks.sendPush.mock.calls[0][0])).not.toContain('alice@example.com'); });
});
