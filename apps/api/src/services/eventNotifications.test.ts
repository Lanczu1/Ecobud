import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  db: {
    user: { findUnique: vi.fn() },
    event: { findUnique: vi.fn(), findMany: vi.fn() },
    eventRegistration: { create: vi.fn(), update: vi.fn() },
    challengeSubmission: { findUnique: vi.fn() },
    eventSubmission: { findUnique: vi.fn(), update: vi.fn() },
    auditLog: { create: vi.fn() },
    $transaction: vi.fn(),
  },
  notify: vi.fn(),
}));
vi.mock('../prismaClient', () => ({ prisma: mocks.db }));
vi.mock('./notificationService', () => ({ sendDirectNotification: mocks.notify }));
vi.mock('./supabaseRealtimeService', () => ({ supabaseRealtimeService: {
  publishUserEventsRefresh: vi.fn(), publishAdminSectionRefresh: vi.fn(),
} }));
vi.mock('./GamificationService', () => ({ GamificationService: class {} }));
vi.mock('./supabaseStorageService', () => ({ supabaseStorageService: {} }));
vi.mock('../http/uploadMiddleware', () => ({ eventSubmissionUploadMiddleware: { single: () => (_req: any, _res: any, next: any) => next() } }));
vi.mock('../http/authentication', () => ({
  authenticateRequest: (req: any, _res: any, next: any) => { req.auth = { userId: 'member' }; next(); },
  requireUserAccess: (_req: any, _res: any, next: any) => next(),
}));
import { eventRoutes } from '../routes/eventRoutes';
import { AdminService } from './adminService';
import { errorResponder } from '../http/errorResponder';

const app = express();
app.use('/events', eventRoutes);
app.use(errorResponder);
beforeEach(() => {
  vi.resetAllMocks();
  mocks.db.user.findUnique.mockResolvedValue({ idVerificationStatus: 'approved', profile: { city: 'Yukos' } });
  mocks.db.event.findMany.mockResolvedValue([]);
  mocks.db.event.findUnique.mockResolvedValue({ id: 'event', title: 'Cleanup', isPublished: true, startDatetime: new Date(Date.now() + 86400000), capacity: 10, registrations: [] });
  mocks.db.eventRegistration.create.mockResolvedValue({ id: 'registration' });
  mocks.db.challengeSubmission.findUnique.mockResolvedValue(null);
  mocks.db.eventSubmission.findUnique.mockResolvedValue({ id: 'submission', user: {} });
  mocks.db.eventSubmission.update.mockResolvedValue({ id: 'submission', eventId: 'event', userId: 'member', event: { title: 'Cleanup' }, user: { id: 'member' }, reviewedAt: new Date() });
  mocks.db.$transaction.mockImplementation(async (run: any) => run(mocks.db));
});

describe('Eco Event notifications', () => {
  it.each(['not_submitted', 'pending', 'rejected'])('allows browsing but blocks event joining when ID is %s', async status => {
    mocks.db.user.findUnique.mockResolvedValue({ idVerificationStatus: status, profile: { city: 'Yukos' } });
    await request(app).get('/events').expect(200);
    const result = await request(app).post('/events/event/join').expect(403);
    expect(result.body.code).toBe('ID_APPROVAL_REQUIRED');
    expect(mocks.db.eventRegistration.create).not.toHaveBeenCalled(); expect(mocks.notify).not.toHaveBeenCalled();
  });
  it('notifies the member after joining with the event destination', async () => {
    await request(app).post('/events/event/join').expect(201);
    expect(mocks.notify).toHaveBeenCalledWith(expect.objectContaining({ userId: 'member', type: 'event', relatedId: 'event', notificationKey: 'event_joined:registration' }));
  });
  it('does not notify again when already joined', async () => {
    const event = await mocks.db.event.findUnique();
    event.registrations = [{ userId: 'member' }];
    await request(app).post('/events/event/join').expect(200);
    expect(mocks.notify).not.toHaveBeenCalled();
  });
  it.each(['approved', 'rejected'] as const)('notifies after attendance is %s', async (status) => {
    await AdminService.reviewSubmission('submission', 'reviewer', status, 'Photo unclear');
    await vi.waitFor(() => expect(mocks.notify).toHaveBeenCalledOnce());
    expect(mocks.notify).toHaveBeenCalledWith(expect.objectContaining({ userId: 'member', type: 'event', relatedId: 'event', title: status === 'approved' ? 'Event Attendance Approved' : 'Event Attendance Rejected', message: status === 'approved' ? 'Your attendance for event "Cleanup" has been approved.' : 'Your attendance for event "Cleanup" was rejected. Notes: Photo unclear' }));
  });
  it('does not notify when the review transaction fails', async () => {
    mocks.db.$transaction.mockRejectedValue(new Error('Save failed'));
    await expect(AdminService.reviewSubmission('submission', 'reviewer', 'approved')).rejects.toThrow('Save failed');
    expect(mocks.notify).not.toHaveBeenCalled();
  });
});
