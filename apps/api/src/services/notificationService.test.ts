import { beforeEach, describe, it, expect, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ db: { notification: { findUnique: vi.fn() }, $queryRaw: vi.fn(), $executeRaw: vi.fn() }, sendMail: vi.fn(), notice: vi.fn() }));
vi.mock('../prismaClient', () => ({ prisma: mocks.db }));
vi.mock('nodemailer', () => ({ default: { createTransport: () => ({ sendMail: mocks.sendMail }) } }));
vi.mock('./supabaseRealtimeService', () => ({ supabaseRealtimeService: { publishUserNotice: mocks.notice } }));
import { deliverNotification } from './notificationService';
const job = { id: 'delivery', notification_id: 'n', channel: 'push', destination: 'ExpoPushToken[abc]', attempts: 1, receipt: null };
beforeEach(() => { vi.clearAllMocks(); mocks.db.notification.findUnique.mockResolvedValue({ id: 'n', userId: 'alice', title: 'New Learn', message: 'A module is available', priority: 'low', user: { status: 'active', sessionVersion: 0, email: 'alice@example.com' } }); mocks.db.$queryRaw.mockResolvedValue([{ token: job.destination }]); });
describe('push delivery isolation', () => {
    it('deactivates an invalid token without removing the in-app notification', async () => { vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ data: { status: 'error', details: { error: 'DeviceNotRegistered' } } }) }))); expect(await deliverNotification(job)).toBe('failed'); expect(String(mocks.db.$executeRaw.mock.calls[0][0])).toContain('DELETE FROM notification_devices'); });
    it('saves accepted tickets for receipt polling', async () => { vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ data: { status: 'ok', id: 'ticket' } }) }))); expect(await deliverNotification(job)).toBe('receipt'); expect(mocks.db.$executeRaw.mock.calls[0]).toContain('ticket'); });
    it('checks receipts without sending the push again', async () => { const fetcher = vi.fn(async () => ({ ok: true, json: async () => ({ data: { ticket: { status: 'ok' } } }) })); vi.stubGlobal('fetch', fetcher); expect(await deliverNotification({ ...job, receipt: 'ticket' })).toBe('sent'); expect(fetcher.mock.calls[0][0]).toContain('getReceipts'); });
    it('never sends to suspended accounts or revoked devices', async () => { mocks.db.$queryRaw.mockResolvedValue([]); const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher); expect(await deliverNotification(job)).toBe('cancelled'); expect(fetcher).not.toHaveBeenCalled(); });
    it('marks explicit throttling as safe to retry', async () => { vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 429 }))); await expect(deliverNotification(job)).rejects.toMatchObject({ retrySafe: true }); });
    it('does not expose account data in push payloads', async () => { const fetcher = vi.fn(async () => ({ ok: true, json: async () => ({ data: { status: 'ok', id: 'ticket' } }) })); vi.stubGlobal('fetch', fetcher); await deliverNotification(job); const body = JSON.parse((fetcher.mock.calls[0] as any)[1].body); expect(body.data).toEqual({ notificationId: 'n' }); expect(JSON.stringify(body)).not.toContain('alice@example.com'); });
});
