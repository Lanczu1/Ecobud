import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => {
  const tx = { $queryRaw: vi.fn(), $executeRaw: vi.fn(), announcement: { findUnique: vi.fn() }, user: { findMany: vi.fn() }, notification: { createMany: vi.fn(), findUnique: vi.fn() }, profile: { findUnique: vi.fn() } };
  return { tx, db: { ...tx, $transaction: vi.fn() }, push: vi.fn(), notice: vi.fn() };
});
vi.mock('../prismaClient', () => ({ prisma: mocks.db }));
vi.mock('nodemailer', () => ({ default: { createTransport: () => ({ sendMail: vi.fn() }) } }));
vi.mock('../lib/firebaseMessaging', () => ({ firebaseMessaging: { send: mocks.push } }));
vi.mock('./supabaseRealtimeService', () => ({ supabaseRealtimeService: { publishUserNotice: mocks.notice } }));
import { fanout, deliverNotification, notificationTick } from './notificationService';
const event = { key: 'announcement_published:a', type: 'announcement', related_id: 'a', title: 'New announcement', message: 'Title', user_id: null, cursor: null, available_at: new Date(), created_at: new Date() };
const announcement = { id: 'a', title: 'Title', status: 'Published', publishAt: new Date(), expiresAt: null, priority: 'Important', targetAudience: 'Specific Barangay', barangays: ['Yukos'] };
const job = { id: 'job', notification_id: 'n', channel: 'push', destination: 'token', attempts: 1, receipt: null };
beforeEach(() => {
  vi.resetAllMocks();
  mocks.db.$transaction.mockImplementation(fn => fn(mocks.tx));
  mocks.tx.$queryRaw.mockResolvedValue([event]);
  mocks.tx.announcement.findUnique.mockResolvedValue(announcement);
  mocks.tx.user.findMany.mockResolvedValue([{ id: 'resident', email: 'test@example.com' }]);
  mocks.tx.notification.findUnique.mockResolvedValue({ id: 'n', type: 'announcement', relatedId: 'a', userId: 'resident', title: 'New announcement', message: 'Title', priority: 'high', user: { status: 'active', sessionVersion: 0 } });
  mocks.tx.profile.findUnique.mockResolvedValue({ city: ' yukos ' });
  mocks.push.mockResolvedValue('message-id');
});
describe('announcement fanout and push', () => {
  it('targets active residents in the selected barangay and creates push jobs', async () => {
    await fanout();
    expect(mocks.tx.user.findMany.mock.calls[0][0].where).toMatchObject({ status: 'active', role: 'user', profile: { is: { OR: [{ city: { equals: 'Yukos', mode: 'insensitive' } }] } } });
    expect(mocks.tx.notification.createMany.mock.calls[0][0]).toMatchObject({ skipDuplicates: true, data: [{ type: 'announcement', relatedId: 'a', priority: 'high' }] });
    expect(mocks.tx.$executeRaw.mock.calls.some(call => String(call[0]).includes("JOIN notification_devices"))).toBe(true);
  });
  it('includes residents without a profile for all-resident posts', async () => {
    mocks.tx.announcement.findUnique.mockResolvedValue({ ...announcement, targetAudience: 'All Residents' });
    await fanout();
    expect(mocks.tx.user.findMany.mock.calls[0][0].where.profile).toBeUndefined();
  });
  it.each([null, { ...announcement, status: 'Archived' }, { ...announcement, expiresAt: new Date(0) }])('skips missing, archived and expired announcements', async item => {
    mocks.tx.announcement.findUnique.mockResolvedValue(item);
    await fanout();
    expect(mocks.tx.notification.createMany).not.toHaveBeenCalled();
    expect(await deliverNotification(job)).toBe('cancelled');
    expect(mocks.push).not.toHaveBeenCalled();
  });
  it('defers a rescheduled post without sending early', async () => {
    mocks.tx.announcement.findUnique.mockResolvedValue({ ...announcement, status: 'Scheduled', publishAt: new Date(Date.now()+86400000) });
    await fanout();
    expect(mocks.tx.user.findMany).not.toHaveBeenCalled();
    expect(String(mocks.tx.$executeRaw.mock.calls[0][0])).toContain('available_at=');
  });
  it('cancels delivery when a resident changes barangay', async () => {
    mocks.tx.profile.findUnique.mockResolvedValue({ city: 'Abo' });
    expect(await deliverNotification(job)).toBe('cancelled');
    expect(mocks.push).not.toHaveBeenCalled();
  });
  it('processes 25 jobs per tick with at most five simultaneous provider calls', async () => {
    const jobs = Array.from({ length: 25 }, (_, i) => ({ ...job, id: 'job-' + i }));
    mocks.tx.$queryRaw.mockResolvedValueOnce([event]).mockResolvedValueOnce(jobs).mockResolvedValue([{ token: 'token' }]);
    let active = 0;
    let maximum = 0;
    mocks.push.mockImplementation(async () => {
      active++;
      maximum = Math.max(maximum, active);
      await new Promise(resolve => setTimeout(resolve, 1));
      active--;
      return 'message-id';
    });
    await notificationTick();
    expect(mocks.push).toHaveBeenCalledTimes(25);
    expect(maximum).toBe(5);
  });
  it('sends an eligible announcement through Firebase', async () => {
    expect(await deliverNotification(job)).toBe('sent');
    expect(mocks.push).toHaveBeenCalledWith(expect.objectContaining({ title: 'New announcement', body: 'Title', notificationId: 'n' }));
  });
});

