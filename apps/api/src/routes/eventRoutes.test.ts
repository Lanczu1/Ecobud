import { beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';

const { db, storage } = vi.hoisted(() => ({
  db: {
    event: { findUnique: vi.fn() },
    eventRegistration: { findUnique: vi.fn(), updateMany: vi.fn() },
    eventQrCode: { findFirst: vi.fn() },
    eventSubmission: { upsert: vi.fn() },
    $transaction: vi.fn(),
  },
  storage: { uploadFile: vi.fn() },
}));
vi.mock('../prismaClient', () => ({ prisma: db }));
vi.mock('../http/authentication', () => ({
  authenticateRequest: (req: any, _res: any, next: any) => { req.auth = { userId: 'member' }; next(); },
  requireUserAccess: (_req: any, _res: any, next: any) => next(),
}));
vi.mock('../http/idVerificationAccess', () => ({ requireApprovedId: (_req: any, _res: any, next: any) => next() }));
vi.mock('../http/uploadMiddleware', () => ({ eventSubmissionUploadMiddleware: { single: () => (req: any, _res: any, next: any) => {
  if (req.body.photo !== false) req.file = { path: '/attendance.jpg', originalname: 'attendance.jpg', mimetype: 'image/jpeg' };
  next();
} } }));
vi.mock('../services/supabaseStorageService', () => ({ supabaseStorageService: storage }));
vi.mock('../services/GamificationService', () => ({ GamificationService: class {} }));
vi.mock('../services/notificationService', () => ({ sendDirectNotification: vi.fn() }));
vi.mock('../services/supabaseRealtimeService', () => ({ supabaseRealtimeService: { publishUserEventsRefresh: vi.fn() } }));
import { eventRoutes } from './eventRoutes';
import { errorResponder } from '../http/errorResponder';

const app = express();
app.use(express.json());
app.use('/events', eventRoutes);
app.use(errorResponder);
const submit = (body: object = { qrData: 'valid-qr' }) => request(app).post('/events/event/submissions').send(body);

beforeEach(() => {
  vi.resetAllMocks();
  db.event.findUnique.mockResolvedValue({ id: 'event', isPublished: true, startDatetime: new Date(Date.now() - 60000), endDatetime: new Date(Date.now() + 60000) });
  db.eventRegistration.findUnique.mockResolvedValue({ id: 'registration', status: 'REGISTERED' });
  db.eventQrCode.findFirst.mockResolvedValue({ eventId: 'event', expiresAt: new Date(Date.now() + 60000) });
  db.eventRegistration.updateMany.mockResolvedValue({ count: 1 });
  db.eventSubmission.upsert.mockImplementation(async ({ create }) => ({ id: 'submission', ...create }));
  db.$transaction.mockImplementation(async run => run(db));
  storage.uploadFile.mockResolvedValue('https://storage.example/attendance.jpg');
});

describe('automatic QR attendance approval', () => {
  it('confirms attendance and approves the photo together, making the reward claimable', async () => {
    const response = await submit().expect(200);
    expect(response.body.submission).toMatchObject({ status: 'approved', qrVerified: true });
    expect(db.$transaction).toHaveBeenCalledOnce();
    expect(db.eventRegistration.updateMany).toHaveBeenCalledWith({
      where: { id: 'registration', status: { in: ['REGISTERED', 'PENDING_APPROVAL'] } },
      data: { status: 'ATTENDED', attendedAt: expect.any(Date) },
    });
    expect(db.eventSubmission.upsert).toHaveBeenCalledWith(expect.objectContaining({
      update: expect.objectContaining({ status: 'approved', rejectionReason: null, reviewedAt: expect.any(Date) }),
    }));
  });
  it.each([{}, { qrData: '' }, { qrData: '   ' }, { qrData: 'valid-qr', photo: false }])('requires QR and photo proof: %j', async body => {
    await submit(body).expect(400);
    expect(storage.uploadFile).not.toHaveBeenCalled();
    expect(db.$transaction).not.toHaveBeenCalled();
  });
  it.each([null, { eventId: 'other', expiresAt: new Date(Date.now() + 60000) }, { eventId: 'event', expiresAt: new Date(0) }])('rejects invalid, wrong-event, or expired QR: %j', async qr => {
    db.eventQrCode.findFirst.mockResolvedValue(qr);
    await submit().expect(400);
    expect(db.eventRegistration.updateMany).not.toHaveBeenCalled();
  });
  it.each(['ATTENDED', 'REWARD_CLAIMED'])('preserves completed attendance: %s', async status => {
    db.eventRegistration.findUnique.mockResolvedValue({ id: 'registration', status });
    await submit().expect(400);
    expect(storage.uploadFile).not.toHaveBeenCalled();
  });
  it('does not overwrite attendance if a concurrent request already confirmed it', async () => {
    db.eventRegistration.updateMany.mockResolvedValue({ count: 0 });
    await submit().expect(409);
    expect(db.eventSubmission.upsert).not.toHaveBeenCalled();
  });
  it('requires registration and an ongoing published event', async () => {
    db.eventRegistration.findUnique.mockResolvedValue(null);
    await submit().expect(400);
    db.eventRegistration.findUnique.mockResolvedValue({ id: 'registration', status: 'REGISTERED' });
    db.event.findUnique.mockResolvedValue({ isPublished: true, startDatetime: new Date(Date.now() + 60000), endDatetime: new Date(Date.now() + 120000) });
    await submit().expect(400);
    db.event.findUnique.mockResolvedValue({ isPublished: false });
    await submit().expect(404);
    expect(storage.uploadFile).not.toHaveBeenCalled();
  });
});
