import { beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';

const { db, files, upload, users } = vi.hoisted(() => ({
  users: new Map<string, any>(),
  db: {
    user: { findUnique: vi.fn(), findUniqueOrThrow: vi.fn(), updateMany: vi.fn(), update: vi.fn() },
    idVerificationSubmission: { findFirst: vi.fn(), findMany: vi.fn(), count: vi.fn(), create: vi.fn(), updateMany: vi.fn(), findUniqueOrThrow: vi.fn() },
    notification: { create: vi.fn() }, $transaction: vi.fn(), $executeRaw: vi.fn(),
  },
  files: { upload: vi.fn(), download: vi.fn(), remove: vi.fn() }, upload: vi.fn(),
}));
vi.mock('../prismaClient', () => ({ prisma: db }));
vi.mock('express-rate-limit', () => ({ default: () => (_req: unknown, _res: unknown, next: () => void) => next() }));
vi.mock('../services/idDocumentStorage', () => ({ idDocumentStorage: files }));
vi.mock('../http/uploadMiddleware', () => ({ avatarUploadMiddleware: { single: () => (req: any, _res: any, next: any) => { upload(); if (req.body.photo !== false) req.file = { path: '/temporary-id', mimetype: 'image/jpeg' }; next(); } } }));
import { TokenService } from '../security/tokenService';
import { idVerificationRoutes } from './idVerificationRoutes';
import { requireApprovedId } from '../http/idVerificationAccess';
import { authenticateRequest } from '../http/authentication';
import { errorResponder } from '../http/errorResponder';

const app = express();
app.use(express.json());
app.use('/ids', idVerificationRoutes);
app.get('/browse', authenticateRequest, (_req, res) => res.json({ ok: true }));
app.post('/participate', authenticateRequest, requireApprovedId, (_req, res) => res.json({ ok: true }));
app.use(errorResponder);
const resident = { id: 'resident', name: 'Resident', email: 'resident@example.com', role: 'user', status: 'active', sessionVersion: 0, idVerificationStatus: 'not_submitted', profile: { city: 'Yukos' } };
const pending = { id: 'submission', userId: resident.id, legalName: 'Resident Name', idType: 'government', barangay: 'Yukos', documentPath: 'private/photo', status: 'pending', submittedAt: new Date(), reason: null };
const auth = (id = 'resident') => `Bearer ${TokenService.sign({ ...users.get(id), userId: id })}`;

beforeEach(() => {
  vi.resetAllMocks(); users.clear();
  users.set('resident', { ...resident });
  users.set('moderator', { ...resident, id: 'moderator', name: 'Reviewer', email: 'reviewer@example.com', role: 'moderator' });
  users.set('admin', { ...resident, id: 'admin', role: 'admin' });
  db.user.findUnique.mockImplementation(async ({ where }) => users.get(where.id));
  db.user.findUniqueOrThrow.mockImplementation(async ({ where }) => users.get(where.id));
  db.user.updateMany.mockResolvedValue({ count: 1 });
  db.idVerificationSubmission.findFirst.mockResolvedValue(pending);
  db.idVerificationSubmission.findUniqueOrThrow.mockResolvedValue({ ...pending, status: 'approved' });
  db.idVerificationSubmission.create.mockImplementation(async ({ data }) => ({ ...pending, ...data }));
  db.idVerificationSubmission.updateMany.mockResolvedValue({ count: 1 });
  db.notification.create.mockResolvedValue({ id: 'notice' });
  db.$transaction.mockImplementation(async fn => fn(db));
  files.upload.mockResolvedValue(undefined); files.remove.mockResolvedValue(undefined);
  files.download.mockResolvedValue({ bytes: Buffer.from('private document'), mime: 'image/jpeg' });
});

describe('ID verification permissions and lifecycle', () => {
  it('requires authentication for status and review', async () => {
    await request(app).get('/ids/me').expect(401);
    await request(app).get('/ids/review/submission/document').expect(401);
  });
  it.each(['not_submitted', 'pending', 'rejected'])('allows browsing but blocks participation with status %s', async status => {
    users.get('resident').idVerificationStatus = status;
    await request(app).get('/browse').set('Authorization', auth()).expect(200);
    const response = await request(app).post('/participate').set('Authorization', auth()).expect(403);
    expect(response.body.code).toBe('ID_APPROVAL_REQUIRED');
  });
  it('uses current database approval rather than token claims', async () => {
    const token = auth(); users.get('resident').idVerificationStatus = 'approved';
    await request(app).post('/participate').set('Authorization', token).expect(200);
    users.get('resident').idVerificationStatus = 'rejected';
    await request(app).post('/participate').set('Authorization', token).expect(403);
  });
  it.each(['resident', 'admin'])('denies document access to %s', async id => {
    await request(app).get('/ids/review/submission/document').set('Authorization', auth(id)).expect(403);
    expect(files.download).not.toHaveBeenCalled();
  });
  it('scopes moderator documents to their assigned barangay', async () => {
    db.idVerificationSubmission.findFirst.mockResolvedValue(null);
    await request(app).get('/ids/review/submission/document').set('Authorization', auth('moderator')).expect(404);
    expect(db.idVerificationSubmission.findFirst).toHaveBeenCalledWith({ where: { id: 'submission', barangay: 'Yukos' } });
    expect(files.download).not.toHaveBeenCalled();
  });
  it('serves private documents without caching', async () => {
    const response = await request(app).get('/ids/review/submission/document').set('Authorization', auth('moderator')).expect(200);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.headers['content-type']).toContain('image/jpeg');
  });
  it('does not expose document paths in resident status queries', async () => {
    await request(app).get('/ids/me').set('Authorization', auth()).expect(200);
    const query = db.idVerificationSubmission.findFirst.mock.calls[0][0];
    expect(query.where.userId).toBe('resident'); expect(query.select.documentPath).toBeUndefined();
  });
  it.each(['pending', 'approved'])('rejects another submission for %s users before uploading', async status => {
    users.get('resident').idVerificationStatus = status;
    await request(app).post('/ids/me').set('Authorization', auth()).send({ legalName: 'Resident Name', idType: 'government', consent: 'true' }).expect(409);
    expect(files.upload).not.toHaveBeenCalled();
  });
  it('requires consent and a supported ID type', async () => {
    await request(app).post('/ids/me').set('Authorization', auth()).send({ legalName: 'Resident Name', idType: 'government' }).expect(400);
    await request(app).post('/ids/me').set('Authorization', auth()).send({ legalName: 'Resident Name', idType: 'fake', consent: 'true' }).expect(400);
    expect(files.upload).not.toHaveBeenCalled();
  });
  it('allows rejected users to resubmit into pending review', async () => {
    users.get('resident').idVerificationStatus = 'rejected';
    await request(app).post('/ids/me').set('Authorization', auth()).send({ legalName: 'Resident Name', idType: 'school', consent: 'true' }).expect(201);
    expect(db.user.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: { idVerificationStatus: 'pending' } }));
    expect(db.idVerificationSubmission.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ userId: 'resident', barangay: 'Yukos', idType: 'school' }) }));
  });
  it('removes the uploaded document if another submission wins the race', async () => {
    db.user.updateMany.mockResolvedValue({ count: 0 });
    await request(app).post('/ids/me').set('Authorization', auth()).send({ legalName: 'Resident Name', idType: 'government', consent: 'true' }).expect(409);
    expect(files.remove).toHaveBeenCalledOnce(); expect(db.idVerificationSubmission.create).not.toHaveBeenCalled();
  });
  it('requires a rejection reason without changing the account', async () => {
    await request(app).patch('/ids/review/submission').set('Authorization', auth('moderator')).send({ status: 'rejected', reason: '  ' }).expect(400);
    expect(db.user.update).not.toHaveBeenCalled();
  });
  it.each(['approved', 'rejected'])('persists %s and queues notifications in the same transaction', async status => {
    await request(app).patch('/ids/review/submission').set('Authorization', auth('moderator')).send({ status, reason: 'Unreadable name' }).expect(200);
    expect(db.user.update).toHaveBeenCalledWith({ where: { id: 'resident' }, data: { idVerificationStatus: status } });
    expect(db.idVerificationSubmission.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'submission', status: 'pending' }, data: expect.objectContaining({ reviewerId: 'moderator', reviewedAt: expect.any(Date) }) }));
    expect(db.notification.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ relatedType: 'id_verification', notificationKey: 'id_review:submission' }) }));
    expect(db.$executeRaw).toHaveBeenCalledTimes(2);
  });
  it('rejects duplicate reviews without sending duplicate notifications', async () => {
    db.idVerificationSubmission.updateMany.mockResolvedValue({ count: 0 });
    await request(app).patch('/ids/review/submission').set('Authorization', auth('moderator')).send({ status: 'approved' }).expect(409);
    expect(db.notification.create).not.toHaveBeenCalled();
  });
});
