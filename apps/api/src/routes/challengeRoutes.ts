import { Router } from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import { prisma } from '../prismaClient';
import { authenticateRequest, AuthenticatedRequest, requireUserAccess } from '../http/authentication';
import { errorBoundary, HttpError } from '../http/errorResponder';
import { getOrCreateActiveInstance } from '../services/cycleManagerService';
import { GamificationService } from '../services/GamificationService';
import { resolveLiveStreak } from '../utils/gamificationUtils';
import { challengeUploadMiddleware, analyzeUploadMiddleware } from '../http/uploadMiddleware';
import { supabaseStorageService } from '../services/supabaseStorageService';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import rateLimit from 'express-rate-limit';
import { JWT_SECRET } from '../security/tokenService';
import { recognizeChallengeImage } from '../services/challengeImageService';
import { signChallengeAnalysis, detectionSettingsHash } from '../security/challengeAnalysisToken';

const challengeRoutes = Router();
const gamificationService = new GamificationService();

// OWASP: DoS / Resource Exhaustion Protection on AI processing and file uploads
const analyzeLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many analysis requests. Please wait a moment before trying again.' },
});

// Cache recently analyzed image hashes to deduplicate identical scans (saves Gemini token quota)
const imageAnalysisCache = new Map<string, { result: any; mimeType: string; timestamp: number }>();
const HASH_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

function cleanOldAnalysisCache() {
  const now = Date.now();
  for (const [key, value] of imageAnalysisCache.entries()) {
    if (now - value.timestamp > HASH_CACHE_TTL_MS) {
      imageAnalysisCache.delete(key);
    }
  }
}

const uploadProofLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many upload requests. Please slow down.' },
});

const qrVerificationLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many verification attempts. Please wait a moment.' },
});

const progressSchema = z.object({
  progressPercentage: z.number().int().min(0).max(100),
});

const submissionSchema = z
  .object({
    proofText: z.string().min(1).max(1000).optional(),
    proofUrl: z.string().optional(),
    afterProofUrl: z.string().optional(),
    detectedQuantity: z.number().int().min(1).default(1),
  })
  .refine((payload) => Boolean(payload.proofText ?? payload.proofUrl), {
    message: 'Provide proof text or a proof URL.',
    path: ['proofText'],
  });

const handleGetChallenges = errorBoundary(async (req: AuthenticatedRequest, res) => {
  const userId = req.auth!.userId;
  const now = new Date();

  const challengeTemplates = await prisma.challenge.findMany({
    where: {
      active: true,
      AND: [
        {
          OR: [
            { startDate: null },
            { startDate: { lte: now } }
          ]
        },
        {
          OR: [
            { endDate: null },
            { endDate: { gt: now } }
          ]
        }
      ]
    },
    orderBy: [{ difficulty: 'asc' }, { title: 'asc' }],
  });

  const items = [];
  for (const challenge of challengeTemplates) {
    const instance = await getOrCreateActiveInstance(challenge.id);
    
    const userChallenge = await prisma.userChallenge.findUnique({
      where: { userId_challengeInstanceId: { userId, challengeInstanceId: instance.id } }
    });
    
    // Get ALL submissions for this challenge template (across all cycles)
    const submissions = await prisma.challengeSubmission.findMany({
      where: { 
        userId, 
        challengeInstance: {
          challengeId: challenge.id
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // We'll keep the latest one as the primary for legacy fields if needed
    const latestSubmission = submissions.length > 0 ? submissions[0] : null;

    let finalStatus = userChallenge?.status || 'not_started';
    if (latestSubmission && finalStatus !== 'COMPLETED') {
      finalStatus = latestSubmission.rewardAwarded ? 'completed' : latestSubmission.status;
    }

    // Re-fetch latest challenge state with fresh availableQuantity
    const freshChallenge = await prisma.challenge.findUnique({ where: { id: challenge.id } });

    items.push({
      ...(freshChallenge || challenge),
      cycle: {
        startDate: instance.startDate,
        endDate: instance.endDate,
        status: instance.status,
        instanceId: instance.id
      },
      progress: {
        progressPercentage: userChallenge?.progressPercentage || 0,
        status: finalStatus,
        rejectionReason: latestSubmission?.status === 'rejected' ? latestSubmission.moderatorNotes : undefined,
        submissionId: latestSubmission?.id,
        submission: latestSubmission ? {
          id: latestSubmission.id,
          status: latestSubmission.rewardAwarded ? 'completed' : latestSubmission.status,
          proofUrl: latestSubmission.proofUrl,
          afterProofUrl: latestSubmission.afterProofUrl,
          detectedQuantity: latestSubmission.detectedQuantity,
          reservedQuantity: latestSubmission.reservedQuantity,
          qrToken: latestSubmission.qrToken,
          qrVerified: latestSubmission.qrVerified,
          adminPreliminaryApproved: latestSubmission.adminPreliminaryApproved,
          adminFinalApproved: latestSubmission.adminFinalApproved,
          rewardAwarded: latestSubmission.rewardAwarded,
          ecoCoinsAwarded: latestSubmission.ecoCoinsAwarded,
          expAwarded: latestSubmission.expAwarded,
        } : undefined,
        submissions: submissions.map(sub => ({
          id: sub.id,
          status: sub.rewardAwarded ? 'completed' : sub.status,
          proofUrl: sub.proofUrl,
          afterProofUrl: sub.afterProofUrl,
          detectedQuantity: sub.detectedQuantity,
          reservedQuantity: sub.reservedQuantity,
          qrToken: sub.qrToken,
          qrVerified: sub.qrVerified,
          adminPreliminaryApproved: sub.adminPreliminaryApproved,
          adminFinalApproved: sub.adminFinalApproved,
          rewardAwarded: sub.rewardAwarded,
          ecoCoinsAwarded: sub.ecoCoinsAwarded,
          expAwarded: sub.expAwarded,
          rejectionReason: sub.status === 'rejected' ? sub.moderatorNotes : undefined,
        }))
      },
    });
  }

  return res.json({ items, isCycleActive: true });
});

challengeRoutes.get('/', authenticateRequest, requireUserAccess, handleGetChallenges);
challengeRoutes.get('/active', authenticateRequest, requireUserAccess, handleGetChallenges);

challengeRoutes.post(
  '/:challengeInstanceId/progress',
  authenticateRequest,
  requireUserAccess,
  errorBoundary(async (req: AuthenticatedRequest, res) => {
    const payload = progressSchema.parse(req.body);
    const userId = req.auth!.userId;
    const instance = await resolveInstance(req.params.challengeInstanceId);
    const actualInstanceId = instance?.id || req.params.challengeInstanceId;

    const result = await gamificationService.updateChallengeProgress(
      userId,
      actualInstanceId,
      payload.progressPercentage,
    );

    // Fix #2: When non-AI challenge hits 100%, create a ChallengeSubmission so
    // the multiple-submission system tracks it as a separate card in My Tasks.
    if (payload.progressPercentage >= 100) {
      await prisma.challengeSubmission.create({
        data: {
          userId,
          challengeInstanceId: actualInstanceId,
          status: 'pending',
          proofUrl: null,
          afterProofUrl: null,
          detectedQuantity: 1,
          reservedQuantity: 1,
          qrToken: null,
          qrVerified: false,
          adminPreliminaryApproved: false,
          adminFinalApproved: false,
          rewardAwarded: false,
          ecoCoinsAwarded: 0,
          expAwarded: 0,
        },
      });
    }

    return res.json(result);
  }),
);

challengeRoutes.post(
  '/:challengeInstanceId/analyze',
  authenticateRequest,
  requireUserAccess,
  analyzeLimiter,
  analyzeUploadMiddleware.single('image'),
  errorBoundary(async (req: AuthenticatedRequest, res) => {
    if (!req.file) {
      throw new HttpError(400, 'Image file is required');
    }

    try {
      const instance = await resolveInstance(req.params.challengeInstanceId);
      const challenge = instance?.challenge;
      if (!instance || !challenge || !challenge.active || challenge.type !== 'AI Image Recognition Challenge') {
        throw new HttpError(404, 'Active AI challenge not found.');
      }

      const bytes = await fs.promises.readFile(req.file.path);

      // Hash deduplication: Compute sha256 to reuse recent analysis of identical image bytes
      cleanOldAnalysisCache();
      const imageHash = crypto.createHash('sha256').update(bytes).digest('hex');
      const cacheKey = `${imageHash}:${challenge.id}:${(challenge.aiDetectionTargets || []).join(',')}:${challenge.aiMinimumConfidence || 1}`;

      let mimeType: string;
      let result: any;

      if (imageAnalysisCache.has(cacheKey)) {
        const cached = imageAnalysisCache.get(cacheKey)!;
        mimeType = cached.mimeType;
        result = cached.result;
      } else {
        const aiResponse = await recognizeChallengeImage(bytes, challenge.aiDetectionTargets, challenge.aiMinimumConfidence || 1);
        mimeType = aiResponse.mimeType;
        const { mimeType: _m, ...resData } = aiResponse;
        result = resData;

        imageAnalysisCache.set(cacheKey, {
          result,
          mimeType,
          timestamp: Date.now(),
        });
      }

      if (!result.passed) {
        return res.json(result);
      }

      const ext = mimeType === 'image/png' ? '.png' : mimeType === 'image/webp' ? '.webp' : '.jpg';
      let proofUrl: string;
      try {
        proofUrl = await supabaseStorageService.uploadFile(
          'challenges/analyzed/' + crypto.randomUUID() + ext,
          req.file.path,
          mimeType,
        );
      } catch {
        throw new HttpError(503, 'Could not save the analyzed photo. Please retry.');
      }

      const analysisToken = signChallengeAnalysis({
        userId: req.auth!.userId,
        instanceId: instance.id,
        proofUrl,
        detectedCount: result.detectedCount,
        settings: detectionSettingsHash(challenge.aiDetectionTargets, challenge.aiMinimumConfidence || 1),
      });

      return res.json({
        ...result,
        proofUrl,
        analysisToken,
        calculatedExpReward: challenge.expReward,
        calculatedEcoCoins: challenge.ecoCoinReward,
      });
    } finally {
      if (req.file?.path) {
        await fs.promises.unlink(req.file.path).catch(() => {});
      }
    }
  }),
);

async function resolveInstance(paramId: string) {
  let instance = await prisma.challengeInstance.findUnique({
    where: { id: paramId },
    include: { challenge: true },
  });

  if (!instance) {
    const challengeExists = await prisma.challenge.findUnique({
      where: { id: paramId },
    });
    if (challengeExists) {
      const createdInstance = await getOrCreateActiveInstance(challengeExists.id);
      instance = await prisma.challengeInstance.findUnique({
        where: { id: createdInstance.id },
        include: { challenge: true },
      });
    }
  }

  return instance;
}

challengeRoutes.post(
  '/:challengeInstanceId/upload-proof',
  authenticateRequest,
  requireUserAccess,
  uploadProofLimiter,
  challengeUploadMiddleware.single('image'),
  errorBoundary(async (req: AuthenticatedRequest, res) => {
    if (!req.file) {
      throw new HttpError(400, 'Image file is required');
    }

    try {
      const instance = await resolveInstance(req.params.challengeInstanceId);
      const actualInstanceId = instance?.id || req.params.challengeInstanceId;
      const ext = path.extname(req.file.originalname) || '.jpg';
      const destinationPath = `challenges/proofs/challenge-${actualInstanceId}-${Date.now()}${ext}`;
      const publicUrl = await supabaseStorageService.uploadFile(
        destinationPath,
        req.file.path,
        req.file.mimetype
      );

      try {
        if (fs.existsSync(req.file.path)) {
          fs.unlinkSync(req.file.path);
        }
      } catch (e) {
        console.error('Failed to cleanup temp proof image:', e);
      }

      return res.json({
        proofUrl: publicUrl,
      });
    } catch (error: any) {
      try {
        if (fs.existsSync(req.file.path)) {
          fs.unlinkSync(req.file.path);
        }
      } catch {}
      throw new HttpError(500, `Failed to upload proof image: ${error.message}`);
    }
  }),
);

challengeRoutes.get(
  '/submissions/mine',
  authenticateRequest,
  requireUserAccess,
  errorBoundary(async (req: AuthenticatedRequest, res) => {
    const items = await prisma.challengeSubmission.findMany({
      where: { userId: req.auth!.userId },
      include: {
        challengeInstance: { include: { challenge: true } },
        reviewer: {
          include: {
            profile: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return res.json({ items });
  }),
);

challengeRoutes.post(
  '/:challengeInstanceId/submissions',
  authenticateRequest,
  requireUserAccess,
  errorBoundary(async (req: AuthenticatedRequest, res) => {
    const payload = submissionSchema.parse(req.body);
    const instance = await resolveInstance(req.params.challengeInstanceId);
    const challenge = instance?.challenge;

    if (!challenge || !challenge.active) {
      throw new HttpError(404, 'Active challenge not found.');
    }

    const actualInstanceId = instance!.id;

    const submission = await prisma.challengeSubmission.create({
      data: {
        userId: req.auth!.userId,
        challengeInstanceId: actualInstanceId,
        proofText: payload.proofText || null,
        proofUrl: payload.proofUrl || null,
        afterProofUrl: payload.afterProofUrl || null,
        status: 'pending',
        detectedQuantity: 1,
        reservedQuantity: 1,
      },
    });

    await prisma.userChallenge.upsert({
      where: {
        userId_challengeInstanceId: {
          userId: req.auth!.userId,
          challengeInstanceId: actualInstanceId,
        },
      },
      create: {
        userId: req.auth!.userId,
        challengeInstanceId: actualInstanceId,
        status: 'IN_PROGRESS',
        progressPercentage: 50,
      },
      update: {
        status: 'IN_PROGRESS',
        progressPercentage: 50,
      },
    });

    return res.status(201).json(submission);
  }),
);

challengeRoutes.post(
  '/:challengeInstanceId/verify-qr',
  authenticateRequest,
  requireUserAccess,
  qrVerificationLimiter,
  errorBoundary(async (req: AuthenticatedRequest, res) => {
    const userId = req.auth!.userId;
    const { qrData, submissionId, latitude, longitude } = req.body;

    if (!qrData) {
      throw new HttpError(400, 'QR data is required.');
    }

    let parsedQr: any;
    try {
      parsedQr = JSON.parse(qrData);
    } catch {
      throw new HttpError(400, 'Invalid QR code format.');
    }

    const instance = await resolveInstance(req.params.challengeInstanceId);
    const actualInstanceId = instance?.id || req.params.challengeInstanceId;

    let submission;
    if (submissionId) {
      submission = await prisma.challengeSubmission.findUnique({
        where: { id: submissionId },
        include: { challengeInstance: { include: { challenge: true } } }
      });
    } else {
      submission = await prisma.challengeSubmission.findFirst({
        where: {
          userId,
          challengeInstanceId: actualInstanceId,
        },
        include: { challengeInstance: { include: { challenge: true } } },
        orderBy: { createdAt: 'desc' }
      });
    }

    if (!submission) {
      throw new HttpError(404, 'Submission not found.');
    }

    // Ensure the submission belongs to the authenticated user
    if (submission.userId !== userId) {
      throw new HttpError(403, 'You do not own this challenge submission.');
    }

    if (!submission.afterProofUrl) {
      throw new HttpError(400, 'You must submit your After Photo before verifying the QR code.');
    }

    // Verify submission token or ID matches if specified
    if (parsedQr.subId && parsedQr.subId !== submission.id) {
      throw new HttpError(400, 'QR code does not match this challenge submission.');
    }

    if (parsedQr.userId && parsedQr.userId !== userId) {
      throw new HttpError(400, 'QR code belongs to a different user.');
    }

    // Replay attack prevention: Ensure QR code has not already been verified
    if (submission.qrVerified) {
      throw new HttpError(400, 'This QR code has already been verified and processed.');
    }

    if (submission.rewardAwarded) {
      throw new HttpError(400, 'This challenge has already been completed.');
    }

    // Strict validation of the cryptographically random QR token
    if (submission.qrToken) {
      try {
        const storedTokenObj = JSON.parse(submission.qrToken);
        if (!parsedQr.token || storedTokenObj.token !== parsedQr.token) {
          throw new HttpError(400, 'Invalid, counterfeit, or expired QR verification token.');
        }
      } catch (err: any) {
        if (err instanceof HttpError) throw err;
        throw new HttpError(400, 'Invalid QR verification token.');
      }
    } else {
      throw new HttpError(400, 'No active QR token generated for this submission. Please submit your After Photo first.');
    }

    const updated = await prisma.challengeSubmission.update({
      where: { id: submission.id },
      data: {
        qrVerified: true,
        qrVerifiedAt: new Date(),
        locationVerified: Boolean(latitude && longitude),
        locationVerifiedAt: latitude && longitude ? new Date() : null,
        status: 'approved',
        adminFinalApproved: true,
        adminFinalApprovedAt: new Date(),
      },
    });

    return res.json({
      message: 'QR code verified successfully. Challenge auto-approved! You can now collect your rewards.',
      submission: updated,
    });
  }),
);

challengeRoutes.post(
  '/:challengeInstanceId/after-photo',
  authenticateRequest,
  requireUserAccess,
  errorBoundary(async (req: AuthenticatedRequest, res) => {
    const { afterProofUrl, submissionId } = req.body;
    const userId = req.auth!.userId;
    const instance = await resolveInstance(req.params.challengeInstanceId);
    const actualInstanceId = instance?.id || req.params.challengeInstanceId;

    if (!afterProofUrl) {
      throw new HttpError(400, 'After photo URL is required.');
    }

    let submission;
    if (submissionId) {
      submission = await prisma.challengeSubmission.findUnique({
        where: { id: submissionId },
        include: { challengeInstance: { include: { challenge: true } } }
      });
    } else {
      submission = await prisma.challengeSubmission.findFirst({
        where: {
          userId,
          challengeInstanceId: actualInstanceId,
        },
        include: { challengeInstance: { include: { challenge: true } } },
        orderBy: { createdAt: 'desc' }
      });
    }

    if (!submission) {
      throw new HttpError(404, 'Submission not found.');
    }

    const challenge = submission.challengeInstance?.challenge;

    // Generate a cryptographically secure random token with HMAC signature to prevent spoofing
    const randomNonce = crypto.randomBytes(16).toString('hex').toUpperCase();
    const tokenPayload = `${submission.id}:${submission.userId}:${randomNonce}`;
    const signature = crypto.createHmac('sha256', JWT_SECRET).update(tokenPayload).digest('hex').substring(0, 16).toUpperCase();
    const updated = await prisma.challengeSubmission.update({
      where: { id: submission.id },
      data: {
        afterProofUrl,
        status: 'final_review',
      }
    });

    return res.json({
      message: 'After photo submitted successfully! Awaiting final admin approval.',
      submission: updated
    });
  }),
);

const claimLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many claim attempts. Please wait a moment.' },
});

challengeRoutes.post(
  '/:challengeInstanceId/claim',
  authenticateRequest,
  requireUserAccess,
  claimLimiter,
  errorBoundary(async (req: AuthenticatedRequest, res) => {
    const userId = req.auth!.userId;
    const { submissionId } = req.body || {};
    const instance = await resolveInstance(req.params.challengeInstanceId);
    const actualInstanceId = instance?.id || req.params.challengeInstanceId;

    if (submissionId) {
      const submission = await prisma.challengeSubmission.findUnique({
        where: { id: submissionId },
        select: { userId: true },
      });
      if (!submission) {
        throw new HttpError(404, 'Submission not found.');
      }
      if (submission.userId !== userId) {
        throw new HttpError(403, 'You do not own this challenge submission.');
      }
    }

    const result = await gamificationService.claimChallenge(userId, actualInstanceId, submissionId);

    return res.json({ message: 'Reward claimed successfully!', ...result });
  }),
);

challengeRoutes.get(
  '/streaks/summary',
  authenticateRequest,
  requireUserAccess,
  errorBoundary(async (req: AuthenticatedRequest, res) => {
    const user = await prisma.user.findUnique({
      where: { id: req.auth!.userId },
      select: {
        currentStreak: true,
        lastActionDate: true,
      },
    });

    return res.json({
      currentStreak: resolveLiveStreak(user?.currentStreak ?? 0, user?.lastActionDate),
      lastActionDate: user?.lastActionDate ?? null,
    });
  }),
);

export { challengeRoutes };
