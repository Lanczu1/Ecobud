import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../prismaClient', () => ({ prisma: {
  event: { findUnique: vi.fn() },
  eventRegistration: { findUnique: vi.fn(), updateMany: vi.fn() },
  eventQrCode: { findFirst: vi.fn() },
  eventSubmission: { upsert: vi.fn() },
  $transaction: vi.fn(),
} }));
vi.mock('../http/authentication', () => ({
  authenticateRequest: (req: any, res: any, next: any) => {
    if (!req.headers.authorization) return res.sendStatus(401);
    req.auth = { userId: 'resident', role: 'user' };
    next();
  },
  requireUserAccess: (_req: any, _res: any, next: any) => next(),
  requireModeratorAccess: (_req: any, _res: any, next: any) => next(),
}));
vi.mock('../http/idVerificationAccess', () => ({ requireApprovedId: (_req: any, _res: any, next: any) => next() }));
vi.mock('../http/uploadMiddleware', () => ({ eventSubmissionUploadMiddleware: { single: () => (req: any, _res: any, next: any) => {
  req.file = { path: 'attendance.jpg', originalname: 'attendance.jpg', mimetype: 'image/jpeg' };
  next();
} } }));
vi.mock('../services/supabaseStorageService', () => ({ supabaseStorageService: { uploadFile: vi.fn() } }));
vi.mock('../services/GamificationService', () => ({ GamificationService: class {} }));
vi.mock('../services/supabaseRealtimeService', () => ({ supabaseRealtimeService: { publishUserEventsRefresh: vi.fn().mockResolvedValue(undefined) } }));
vi.mock('../services/notificationService', () => ({ sendDirectNotification: vi.fn().mockResolvedValue({ id: 'notice' }) }));

import { prisma } from '../prismaClient';
import { sendDirectNotification } from '../services/notificationService';
import { supabaseStorageService } from '../services/supabaseStorageService';
import { errorResponder } from '../http/errorResponder';
import { eventRoutes } from './eventRoutes';

const app = express();
app.use(express.json());
app.use('/events', eventRoutes);
app.use(errorResponder);
const submit = () => request(app).post('/events/event/submissions').set('Authorization', 'Bearer session').send({ qrData: 'valid-qr', userId: 'another-resident' });

beforeEach(() => {
  vi.clearAllMocks();
  const now = Date.now();
  vi.mocked(prisma.event.findUnique).mockResolvedValue({ id: 'event', title: 'Yukos Cleanup', isPublished: true, startDatetime: new Date(now - 60000), endDatetime: new Date(now + 60000) } as any);
  vi.mocked(prisma.eventRegistration.findUnique).mockResolvedValue({ id: 'registration', status: 'REGISTERED' } as any);
  vi.mocked(prisma.eventQrCode.findFirst).mockResolvedValue({ eventId: 'event', expiresAt: new Date(now + 60000) } as any);
  vi.mocked(prisma.eventRegistration.updateMany).mockResolvedValue({ count: 1 });
  vi.mocked(prisma.eventSubmission.upsert).mockResolvedValue({ id: 'submission', status: 'approved', qrVerified: true } as any);
  vi.mocked(prisma.$transaction).mockImplementation(async (callback: any) => callback(prisma));
  vi.mocked(supabaseStorageService.uploadFile).mockResolvedValue('https://example.test/attendance.jpg');
});

describe('QR attendance auto-approval notifications', () => {
  it('queues a high-priority push and inbox notification for the signed-in resident after approval', async () => {
    const response = await submit();
    expect(response.status).toBe(200);
    expect(response.body.submission).toMatchObject({ status: 'approved', qrVerified: true });
    expect(sendDirectNotification).toHaveBeenCalledExactlyOnceWith({
      userId: 'resident', type: 'event', title: 'Attendance approved',
      message: 'Your QR check-in for "Yukos Cleanup" was automatically approved. You can now claim your reward.',
      relatedId: 'event', relatedType: 'event', priority: 'high', notificationKey: 'event_qr_approved:submission',
    });
    expect(vi.mocked(prisma.$transaction).mock.invocationCallOrder[0]).toBeLessThan(vi.mocked(sendDirectNotification).mock.invocationCallOrder[0]);
  });

  it.each(['ATTENDED', 'REWARD_CLAIMED'])('does not notify again when attendance is already %s', async status => {
    vi.mocked(prisma.eventRegistration.findUnique).mockResolvedValue({ id: 'registration', status } as any);
    expect((await submit()).status).toBe(400);
    expect(sendDirectNotification).not.toHaveBeenCalled();
  });

  it.each(['invalid', 'wrong-event', 'expired'])('does not notify for a %s QR', async scenario => {
    vi.mocked(prisma.eventQrCode.findFirst).mockResolvedValue(scenario === 'invalid' ? null : { eventId: scenario === 'wrong-event' ? 'other' : 'event', expiresAt: new Date(scenario === 'expired' ? 0 : Date.now() + 60000) } as any);
    expect((await submit()).status).toBe(400);
    expect(sendDirectNotification).not.toHaveBeenCalled();
  });

  it('does not notify when another request has already confirmed attendance', async () => {
    vi.mocked(prisma.eventRegistration.updateMany).mockResolvedValue({ count: 0 });
    expect((await submit()).status).toBe(409);
    expect(sendDirectNotification).not.toHaveBeenCalled();
  });

  it('does not notify when the approval transaction fails', async () => {
    vi.mocked(prisma.$transaction).mockRejectedValueOnce(new Error('Approval failed'));
    expect((await submit()).status).toBe(500);
    expect(sendDirectNotification).not.toHaveBeenCalled();
  });

  it('requires authentication', async () => {
    expect((await request(app).post('/events/event/submissions').send({ qrData: 'valid-qr' })).status).toBe(401);
    expect(sendDirectNotification).not.toHaveBeenCalled();
  });
});
