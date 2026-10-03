import { beforeEach, expect, it, vi } from 'vitest';
const { findUnique, sendMail } = vi.hoisted(() => ({ findUnique: vi.fn(), sendMail: vi.fn() }));
vi.mock('../prismaClient', () => ({ prisma: { notification: { findUnique } } }));
vi.mock('nodemailer', () => ({ default: { createTransport: () => ({ sendMail }) } }));
vi.mock('./supabaseRealtimeService', () => ({ supabaseRealtimeService: {} }));
vi.mock('../lib/firebaseMessaging', () => ({ firebaseMessaging: {} }));
import { deliverNotification } from './notificationService';
const job = { id: 'delivery', notification_id: 'review-notice', channel: 'email', destination: 'resident@example.com', attempts: 1, receipt: null };
beforeEach(() => {
  vi.clearAllMocks();
  findUnique.mockResolvedValue({ id: 'review-notice', userId: 'resident', relatedType: 'id_verification', title: 'ID needs resubmission', message: 'Your ID was rejected. Reason: unreadable name.', user: { status: 'active', email: job.destination, sessionVersion: 0 } });
});
it('sends the review result and reason with a notification-specific message ID', async () => {
  expect(await deliverNotification(job)).toBe('sent');
  expect(sendMail).toHaveBeenCalledWith(expect.objectContaining({
    subject: 'ECOBUD: ID needs resubmission', text: expect.stringContaining('Reason: unreadable name.'), messageId: '<notification-review-notice@ecobud.app>',
  }));
  expect(sendMail.mock.calls[0][0].text).not.toContain('private/');
});
it('cancels email sent to an address that is no longer owned by the account', async () => {
  expect(await deliverNotification({ ...job, destination: 'old@example.com' })).toBe('cancelled');
  expect(sendMail).not.toHaveBeenCalled();
});
