import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../http/authentication', () => ({
  authenticateRequest: (req: any, _res: any, next: any) => { req.auth = { userId: 'resident', role: 'user' }; next(); },
  requireRoles: () => (_req: any, _res: any, next: any) => next(),
}));
vi.mock('express-rate-limit', () => ({ default: () => (_req: any, _res: any, next: any) => next() }));
vi.mock('../http/uploadMiddleware', () => ({ avatarUploadMiddleware: { single: () => (req: any, _res: any, next: any) => {
  if (req.headers['x-test-photo'] === 'yes') req.file = { path: 'test-id.jpg', mimetype: 'image/jpeg' };
  next();
} } }));
vi.mock('../prismaClient', () => ({ prisma: {
  user: { findUniqueOrThrow: vi.fn(), updateMany: vi.fn() },
  idVerificationSubmission: { create: vi.fn() },
  $transaction: vi.fn(),
} }));
vi.mock('../services/idDocumentStorage', () => ({ idDocumentStorage: { upload: vi.fn(), remove: vi.fn() } }));
vi.mock('../services/idDocumentCleanup', () => ({ removeReviewedIdPhoto: vi.fn() }));

import { prisma } from '../prismaClient';
import { idDocumentStorage } from '../services/idDocumentStorage';
import { errorResponder } from '../http/errorResponder';
import { idVerificationRoutes } from './idVerificationRoutes';

const app = express();
app.use(express.json());
app.use('/id-verification', idVerificationRoutes);
app.use(errorResponder);
const payload = { legalName: '  Test Resident  ', idType: 'valid', consent: 'true' };

describe('Valid ID submission', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(prisma.user.findUniqueOrThrow).mockResolvedValue({ idVerificationStatus: 'not_submitted', profile: { city: 'Yukos' } } as any);
    vi.mocked(prisma.user.updateMany).mockResolvedValue({ count: 1 });
    vi.mocked(prisma.$transaction).mockImplementation(async (callback: any) => callback(prisma));
    vi.mocked(prisma.idVerificationSubmission.create).mockImplementation(async (args: any) => ({ id: 'submission', ...args.data, status: 'pending' }));
  });

  it.each(['not_submitted', 'rejected'])('accepts a valid ID from a %s resident and returns pending', async status => {
    vi.mocked(prisma.user.findUniqueOrThrow).mockResolvedValue({ idVerificationStatus: status, profile: { city: 'Yukos' } } as any);
    const response = await request(app).post('/id-verification/me').set('x-test-photo', 'yes').send(payload);
    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({ status: 'pending', submission: { idType: 'valid', legalName: 'Test Resident' } });
    expect(idDocumentStorage.upload).toHaveBeenCalledOnce();
    expect(prisma.idVerificationSubmission.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ userId: 'resident', idType: 'valid', barangay: 'Yukos' }) }));
  });

  it.each(['government', 'school', 'barangay'])('keeps older %s clients compatible', async idType => {
    const response = await request(app).post('/id-verification/me').set('x-test-photo', 'yes').send({ ...payload, idType });
    expect(response.status).toBe(201);
    expect(response.body.submission.idType).toBe(idType);
  });

  it.each([{ idType: 'other' }, { idType: '' }, { consent: 'false' }, { legalName: ' ' }])('rejects invalid fields before uploading: %j', async changes => {
    const response = await request(app).post('/id-verification/me').set('x-test-photo', 'yes').send({ ...payload, ...changes });
    expect(response.status).toBe(400);
    expect(idDocumentStorage.upload).not.toHaveBeenCalled();
    expect(prisma.idVerificationSubmission.create).not.toHaveBeenCalled();
  });

  it('requires an ID photo', async () => {
    const response = await request(app).post('/id-verification/me').send(payload);
    expect(response.status).toBe(400);
    expect(response.body.message).toContain('valid ID');
    expect(idDocumentStorage.upload).not.toHaveBeenCalled();
  });

  it.each(['pending', 'approved'])('prevents duplicate submission for %s residents', async status => {
    vi.mocked(prisma.user.findUniqueOrThrow).mockResolvedValue({ idVerificationStatus: status } as any);
    const response = await request(app).post('/id-verification/me').set('x-test-photo', 'yes').send(payload);
    expect(response.status).toBe(409);
    expect(idDocumentStorage.upload).not.toHaveBeenCalled();
  });
});
