import { beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';

const { db, storage } = vi.hoisted(() => ({
  db: {
    event: { findUnique: vi.fn(), findMany: vi.fn() },
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

describe('event directory pagination', () => {
  it('bounds pages and continues across featured events with equal start times', async () => {
    db.event.findMany.mockResolvedValue(Array.from({ length: 21 }, (_, index) => ({
      id: `event${index}`, startDatetime: new Date('2026-10-04T10:00:00Z'), isFeatured: true, capacity: 50, _count: { registrations: 5 },
    })));
    const first = await request(app).get('/events').expect(200);
    expect(first.body.items).toHaveLength(20);
    expect(first.body.items[0].spotsLeft).toBe(45);
    await request(app).get('/events').query({ cursor: first.body.nextCursor }).expect(200);
    expect(db.event.findMany).toHaveBeenLastCalledWith(expect.objectContaining({
      take: 21, orderBy: [{ isFeatured: 'desc' }, { startDatetime: 'asc' }, { id: 'asc' }],
      where: { AND: [
        { isPublished: true, OR: [{ barangay: null }] },
        { OR: [
          { isFeatured: false },
          { isFeatured: true, startDatetime: { gt: new Date('2026-10-04T10:00:00Z') } },
          { isFeatured: true, startDatetime: new Date('2026-10-04T10:00:00Z'), id: { gt: 'event19' } },
        ] },
      ] },
    }));
  });

  it.each(['browse', 'past'])('filters %s before pagination', async scope => {
    db.event.findMany.mockResolvedValue([]);
    const response = await request(app).get('/events').query({ scope }).expect(200);
    expect(response.body.nextCursor).toBeNull();
    const query = db.event.findMany.mock.calls[0][0];
    expect(query.where.AND[1].endDatetime).toHaveProperty(scope === 'past' ? 'lte' : 'gt');
    expect(query.take).toBe(21);
  });

  it('applies the deep-link ID independently of the active tab', async () => {
    db.event.findMany.mockResolvedValue([]);
    await request(app).get('/events?scope=browse&id=past-event').expect(200);
    expect(db.event.findMany.mock.calls[0][0].where.AND[1]).toEqual({ id: 'past-event' });
  });

  it.each(['scope=wrong', 'limit=1000', 'cursor=bad!'])('rejects invalid event paging: %s', async query => {
    await request(app).get(`/events?${query}`).expect(400);
    expect(db.event.findMany).not.toHaveBeenCalled();
  });
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
