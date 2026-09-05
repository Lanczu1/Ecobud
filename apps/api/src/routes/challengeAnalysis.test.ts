import express from 'express';
import request from 'supertest';
import fs from 'fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { errorResponder, HttpError } from '../http/errorResponder';
import { detectionSettingsHash, signChallengeAnalysis } from '../security/challengeAnalysisToken';

const { db, recognize, upload } = vi.hoisted(() => ({
  db: { challengeInstance: { findUnique: vi.fn() }, challenge: { findUnique: vi.fn() }, challengeSubmission: { findFirst: vi.fn(), create: vi.fn() }, userChallenge: { upsert: vi.fn() }, $transaction: vi.fn() },
  recognize: vi.fn(), upload: vi.fn(),
}));
vi.mock('../prismaClient', () => ({ prisma: db }));
vi.mock('../http/authentication', () => ({
  authenticateRequest: (req: any, res: any, next: () => void) => {
    if (!req.headers.authorization) return res.status(401).end();
    req.auth = { userId: 'alice' }; next();
  },
  requireUserAccess: (_req: any, _res: any, next: () => void) => next(),
}));
vi.mock('../services/challengeImageService', () => ({ recognizeChallengeImage: recognize }));
vi.mock('../services/supabaseStorageService', () => ({ supabaseStorageService: { uploadFile: upload } }));
vi.mock('../services/cycleManagerService', () => ({ getOrCreateActiveInstance: vi.fn() }));
vi.mock('../services/GamificationService', () => ({ GamificationService: class {} }));
import { challengeRoutes } from './challengeRoutes';

const app = express(); app.use(express.json(), challengeRoutes, errorResponder);
const proofUrl = 'https://example.com/bread-bag.png';
const settings = detectionSettingsHash(['Plastic Wrapper'], 80);
const token = () => signChallengeAnalysis({ userId: 'alice', instanceId: 'week', proofUrl, settings, detectedCount: 2 });
const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
beforeEach(() => {
  vi.clearAllMocks();
  db.challengeInstance.findUnique.mockResolvedValue({ id: 'week', endDate: new Date(Date.now() + 86400000), challenge: { id: 'template', active: true, type: 'AI Image Recognition Challenge', aiDetectionTargets: ['Plastic Wrapper'], aiMinimumConfidence: 80, expReward: 100, ecoCoinReward: 5 } });
  db.challengeSubmission.findFirst.mockResolvedValue(null);
  db.challengeSubmission.create.mockImplementation(async ({ data }) => ({ id: 'submission', ...data }));
  db.$transaction.mockImplementation(async (run) => run(db));
  recognize.mockResolvedValue({ passed: true, object: 'Plastic Wrapper', confidence: 95, detectedCount: 2, mimeType: 'image/png' });
  upload.mockResolvedValue(proofUrl);
});

describe('AI analysis workflow security', () => {
  it('requires authentication before accepting a photo', async () => {
    await request(app).post('/week/analyze').attach('image', png, 'photo.png').expect(401);
    expect(recognize).not.toHaveBeenCalled();
  });
  it('uses stored admin classes, returns a signed result and deletes the temporary photo', async () => {
    const result = await request(app).post('/week/analyze').set('Authorization', 'Bearer test').attach('image', png, 'photo.png').expect(200);
    expect(recognize).toHaveBeenCalledWith(expect.any(Buffer), ['Plastic Wrapper'], 80);
    expect(result.body.analysisToken).toBeTruthy();
    expect(fs.existsSync(upload.mock.calls[0][1])).toBe(false);
    expect(upload.mock.calls[0][0]).toMatch(/^challenges\/analyzed\/[a-f0-9-]+\.png$/);
  });
  it('does not upload or sign a failed detection', async () => {
    recognize.mockResolvedValue({ passed: false, object: 'Unknown', confidence: 0, detectedCount: 0, mimeType: 'image/png' });
    const result = await request(app).post('/week/analyze').set('Authorization', 'Bearer test').attach('image', png, 'photo.png').expect(200);
    expect(result.body.analysisToken).toBeUndefined(); expect(upload).not.toHaveBeenCalled();
  });
  it('fails closed when Gemini is unavailable', async () => {
    recognize.mockRejectedValueOnce(new HttpError(503, 'Image recognition is temporarily unavailable.'));
    await request(app).post('/week/analyze').set('Authorization', 'Bearer test').attach('image', png, 'photo.png').expect(503);
    expect(upload).not.toHaveBeenCalled();
  });
  it('rejects direct submissions without successful AI analysis', async () => {
    await request(app).post('/week/submissions').set('Authorization', 'Bearer test').send({ proofUrl }).expect(400);
    expect(db.challengeSubmission.create).not.toHaveBeenCalled();
  });
  it('uses the signed count and ignores client-supplied count/after-photo', async () => {
    const result = await request(app).post('/week/submissions').set('Authorization', 'Bearer test').send({ proofUrl, analysisToken: token(), detectedQuantity: 999, afterProofUrl: 'https://example.com/fake.png' }).expect(201);
    expect(result.body.detectedQuantity).toBe(2); expect(result.body.afterProofUrl).toBeNull();
    expect(db.$transaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: 'Serializable' });
  });
  it('rejects reuse of an analyzed photo', async () => {
    db.challengeSubmission.findFirst.mockResolvedValue({ id: 'existing' });
    await request(app).post('/week/submissions').set('Authorization', 'Bearer test').send({ proofUrl, analysisToken: token() }).expect(409);
    expect(db.challengeSubmission.create).not.toHaveBeenCalled();
  });
  it('blocks generic progress as an AI detection bypass', async () => {
    await request(app).post('/week/progress').set('Authorization', 'Bearer test').send({ progressPercentage: 100 }).expect(400);
    expect(db.challengeSubmission.create).not.toHaveBeenCalled();
  });
});
