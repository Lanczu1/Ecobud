import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  instance: vi.fn(), find: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn(), upsert: vi.fn(), transaction: vi.fn(),
  userRefresh: vi.fn(), adminRefresh: vi.fn(), notification: vi.fn(),
}));
vi.mock('../prismaClient', () => ({ prisma: {
  challengeInstance: { findUnique: mocks.instance },
  challengeSubmission: { findUnique: mocks.find, findFirst: mocks.findFirst, create: mocks.create, update: mocks.update },
  userChallenge: { upsert: mocks.upsert }, $transaction: mocks.transaction,
} }));
vi.mock('../http/authentication', () => ({
  authenticateRequest: (req: any, _res: any, next: any) => { req.auth = { userId: 'resident', role: 'user' }; next(); },
  requireUserAccess: (_req: any, _res: any, next: any) => next(),
}));
vi.mock('../http/idVerificationAccess', () => ({ requireApprovedId: (_req: any, _res: any, next: any) => next() }));
vi.mock('../http/uploadMiddleware', () => ({
  challengeUploadMiddleware: { single: () => (_req: any, _res: any, next: any) => next() },
  analyzeUploadMiddleware: { single: () => (_req: any, _res: any, next: any) => next() },
}));
vi.mock('../services/GamificationService', () => ({ GamificationService: class {} }));
vi.mock('../services/StreakService', () => ({ StreakService: class {} }));
vi.mock('../services/cycleManagerService', () => ({ getOrCreateActiveInstance: vi.fn(), getOrCreateActiveInstancesBatch: vi.fn() }));
vi.mock('../services/challengeImageService', () => ({ recognizeChallengeImage: vi.fn() }));
vi.mock('../services/supabaseStorageService', () => ({ supabaseStorageService: {} }));
vi.mock('../services/notificationService', () => ({ sendDirectNotification: mocks.notification }));
vi.mock('../services/supabaseRealtimeService', () => ({ supabaseRealtimeService: { publishUserSectionBundle: mocks.userRefresh, publishAdminSectionRefresh: mocks.adminRefresh } }));
vi.mock('./challengePhotoDeletionRoutes', () => ({ challengePhotoDeletionRoutes: express.Router() }));
vi.mock('../services/challengePhotoDeletion', () => ({ challengePhotoDeletionStatuses: vi.fn() }));

import { prisma } from '../prismaClient';
import { challengeRoutes } from './challengeRoutes';
import { errorResponder } from '../http/errorResponder';
const app = express();
app.use(express.json());
app.use('/challenges', challengeRoutes);
app.use(errorResponder);
const submission = { id: 'submission', userId: 'resident', challengeInstanceId: 'instance', proofUrl: '/before.jpg', afterProofUrl: null, status: 'approved_collection', challengeInstance: { challenge: { title: 'Recycle' } } };

describe('challenge submission sync', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.instance.mockResolvedValue({ id: 'instance', challenge: { id: 'challenge', title: 'Recycle', active: true, type: 'Manual' } });
    mocks.find.mockResolvedValue(submission);
    mocks.create.mockResolvedValue(submission);
    mocks.update.mockImplementation(({ data }) => Promise.resolve({ ...submission, ...data, updatedAt: '2026-10-19T12:00:00Z' }));
    mocks.transaction.mockImplementation(callback => callback(prisma));
    mocks.userRefresh.mockResolvedValue(undefined);
    mocks.adminRefresh.mockResolvedValue(true);
    mocks.notification.mockResolvedValue(undefined);
  });

  it.each(['before', 'after'])('publishes resident and admin refreshes after %s proof', async stage => {
    const response = stage === 'before'
      ? await request(app).post('/challenges/instance/submissions').send({ proofUrl: '/before.jpg' })
      : await request(app).post('/challenges/instance/after-photo').send({ submissionId: 'submission', afterProofUrl: '/after.jpg' });
    expect(response.status).toBe(stage === 'before' ? 201 : 200);
    expect(mocks.userRefresh).toHaveBeenCalledWith('resident', ['challenges', 'tracker'], expect.objectContaining({ entityId: 'instance' }));
    expect(mocks.adminRefresh).toHaveBeenCalledWith('dashboard', expect.objectContaining({ entityId: 'submission' }));
    if (stage === 'after') {
      expect(response.body.submission).toMatchObject({ proofUrl: '/before.jpg', afterProofUrl: '/after.jpg', updatedAt: '2026-10-19T12:00:00Z', status: 'final_review' });
    }
  });

  it('does not update or broadcast another resident’s submission', async () => {
    mocks.find.mockResolvedValue({ ...submission, userId: 'someone-else' });
    expect((await request(app).post('/challenges/instance/after-photo').send({ submissionId: 'submission', afterProofUrl: '/after.jpg' })).status).toBe(403);
    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.adminRefresh).not.toHaveBeenCalled();
  });

  it('does not change activity or broadcast a duplicate After photo', async () => {
    mocks.find.mockResolvedValue({ ...submission, afterProofUrl: '/after.jpg' });
    expect((await request(app).post('/challenges/instance/after-photo').send({ submissionId: 'submission', afterProofUrl: '/after.jpg' })).status).toBe(200);
    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.userRefresh).not.toHaveBeenCalled();
  });
});
