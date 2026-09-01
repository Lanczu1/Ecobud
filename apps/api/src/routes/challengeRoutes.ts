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

    let instance = await prisma.challengeInstance.findUnique({
      where: { id: req.params.challengeInstanceId },
      include: { challenge: true }
    });

    if (!instance) {
      const challengeExists = await prisma.challenge.findUnique({
        where: { id: req.params.challengeInstanceId },
      });
      if (challengeExists) {
        const createdInstance = await getOrCreateActiveInstance(challengeExists.id);
        instance = await prisma.challengeInstance.findUnique({
          where: { id: createdInstance.id },
          include: { challenge: true },
        });
      }
    }

    const challenge = instance?.challenge;

    if (!challenge || !challenge.active) {
      fs.unlinkSync(req.file.path);
      throw new HttpError(404, 'Active challenge not found.');
    }

    const scriptPath = path.join(__dirname, '../utils/analyze_image.py');
    const imagePath = req.file.path;

    return new Promise((resolve, reject) => {
      const pythonCommand = process.platform === 'win32' ? 'py' : 'python';
      const rawTargets = Array.isArray(challenge.aiDetectionTargets) && (challenge.aiDetectionTargets as any[]).length > 0
        ? (challenge.aiDetectionTargets as string[])
        : ['Plastic Bottle', 'Glass Bottle'];
      const targetsArg = rawTargets.join(',');
      const pythonProcess = spawn(pythonCommand, [scriptPath, imagePath, targetsArg]);
      
      let outputData = '';
      let errorData = '';

      pythonProcess.on('error', (err) => {
        try { fs.unlinkSync(imagePath); } catch {}
        reject(new HttpError(500, `Failed to start Python (${pythonCommand}): ${err.message}`));
      });

      pythonProcess.stdout.on('data', (data) => {
        outputData += data.toString();
      });

      pythonProcess.stderr.on('data', (data) => {
        errorData += data.toString();
        console.error(`Python stderr: ${data}`);
      });

      pythonProcess.on('close', (code) => {
        if (code !== 0) {
          reject(new HttpError(500, `YOLO analysis failed: ${errorData}`));
          return;
        }

        try {
          const lines = outputData.trim().split('\n');
          const lastLine = lines[lines.length - 1];
          const result = JSON.parse(lastLine);
          if (result.error) {
            reject(new HttpError(500, result.error));
            return;
          }

          const detected = result.detected || [];
          const targets = rawTargets.map(t => String(t).toLowerCase().trim());
          const minConf = challenge.aiMinimumConfidence || 30;

          let passed = false;
          let matchedObject = 'Unknown';
          let maxConfidence = 0;
          let reason = 'No matching object detected';
          let detectedCount = 0;

          for (const det of detected) {
            const detObj = det.object.toLowerCase().trim();
            const escapeRegExp = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const matchedTargetIndex = targets.findIndex(t => {
              if (t === detObj) return true;
              if (t.includes('bottle') && detObj === 'bottle') return true;
              if (t.includes('glass') && (detObj === 'wine glass' || detObj === 'cup' || detObj === 'bottle')) return true;
              if (t.includes('cup') && detObj === 'cup') return true;
              const tRegex = new RegExp(`\\b${escapeRegExp(t)}\\b`, 'i');
              const detRegex = new RegExp(`\\b${escapeRegExp(detObj)}\\b`, 'i');
              return tRegex.test(detObj) || detRegex.test(t);
            });
            const isMatch = matchedTargetIndex !== -1;
            
            if (isMatch) {
              const originalTarget = rawTargets[matchedTargetIndex] || det.object;
              if (det.confidence >= minConf) {
                passed = true;
                matchedObject = originalTarget;
                detectedCount++;
                if (det.confidence > maxConfidence) {
                  maxConfidence = det.confidence;
                }
              } else if (!passed && det.confidence > maxConfidence) {
                matchedObject = originalTarget;
                maxConfidence = det.confidence;
                reason = `Confidence ${det.confidence.toFixed(1)}% is below minimum ${minConf}%`;
              }
            }
          }

          if (passed) {
            reason = '';
          } else if (matchedObject === 'Unknown') {
            reason = `No ${targets.join(' or ')} detected in the image`;
          }

          const calculatedExpReward = challenge.expReward;
          const calculatedEcoCoins = challenge.ecoCoinReward;

          if (passed) {
            const ext = path.extname(req.file!.originalname) || '.jpg';
            const destinationPath = `challenges/analyzed/challenge-${req.params.challengeInstanceId}-${Date.now()}${ext}`;
            
            supabaseStorageService
              .uploadFile(destinationPath, req.file!.path, req.file!.mimetype)
              .then((publicUrl) => {
                try {
                  if (fs.existsSync(req.file!.path)) {
                    fs.unlinkSync(req.file!.path);
                  }
                } catch (e) {
                  console.error('Failed to remove temp analyzed file:', e);
                }

                res.json({
                  passed: true,
                  object: matchedObject,
                  confidence: Math.round(maxConfidence),
                  detectedCount: 1,
                  calculatedExpReward,
                  calculatedEcoCoins,
                  proofUrl: publicUrl,
                });
                resolve(undefined);
              })
              .catch((err) => {
                try {
                  if (fs.existsSync(req.file!.path)) {
                    fs.unlinkSync(req.file!.path);
                  }
                } catch {}
                reject(new HttpError(500, `Failed to store image in cloud: ${err.message}`));
              });
          } else {
            try {
              if (fs.existsSync(req.file!.path)) {
                fs.unlinkSync(req.file!.path);
              }
            } catch (e) {
              console.error('Failed to remove failed analyzed file:', e);
            }

            res.json({
              passed: false,
              object: matchedObject,
              confidence: Math.round(maxConfidence),
              detectedCount: 0,
              reason,
            });
            resolve(undefined);
          }
        } catch (err: any) {
          console.error('Error handling YOLO output:', err);
          try {
            if (req.file && fs.existsSync(req.file.path)) {
              fs.unlinkSync(req.file.path);
            }
          } catch {}
          reject(new HttpError(500, `Failed to parse YOLO analysis output: ${err.message || err}`));
        }
      });
    });
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
    const tokenSecret = process.env.JWT_SECRET || 'ecobud_secure_qr_salt_2026';
    const signature = crypto.createHmac('sha256', tokenSecret).update(tokenPayload).digest('hex').substring(0, 16).toUpperCase();
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
