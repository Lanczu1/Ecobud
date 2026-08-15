import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../prismaClient';
import { authenticateRequest, AuthenticatedRequest, requireUserAccess } from '../http/authentication';
import { errorBoundary, HttpError } from '../http/errorResponder';
import { getOrCreateActiveInstance, isCycleActive } from '../services/cycleManagerService';
import { GamificationService } from '../services/GamificationService';
import { resolveLiveStreak } from '../utils/gamificationUtils';
import { challengeUploadMiddleware, analyzeUploadMiddleware } from '../http/uploadMiddleware';
import { supabaseStorageService } from '../services/supabaseStorageService';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';

const challengeRoutes = Router();
const gamificationService = new GamificationService();

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
  const cycleActive = isCycleActive();

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
    
    // Get ALL submissions for this challenge instance
    const submissions = await prisma.challengeSubmission.findMany({
      where: { userId, challengeInstanceId: instance.id },
      orderBy: { createdAt: 'desc' }
    });

    // We'll keep the latest one as the primary for legacy fields if needed
    const latestSubmission = submissions.length > 0 ? submissions[0] : null;

    let finalStatus = userChallenge?.status || 'not_started';
    if (latestSubmission && finalStatus !== 'COMPLETED') {
      finalStatus = latestSubmission.status;
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
          status: latestSubmission.status,
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
          status: sub.status,
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

  return res.json({ items, isCycleActive: cycleActive });
});

challengeRoutes.get('/', authenticateRequest, requireUserAccess, handleGetChallenges);
challengeRoutes.get('/active', authenticateRequest, requireUserAccess, handleGetChallenges);

challengeRoutes.post(
  '/:challengeInstanceId/progress',
  authenticateRequest,
  requireUserAccess,
  errorBoundary(async (req: AuthenticatedRequest, res) => {
    if (!isCycleActive()) {
      throw new HttpError(403, 'Challenges are disabled during weekends.');
    }
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
  analyzeUploadMiddleware.single('image'),
  errorBoundary(async (req: AuthenticatedRequest, res) => {
    if (!isCycleActive()) {
      throw new HttpError(403, 'Challenges are disabled during weekends.');
    }
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

    if (!challenge || !challenge.active || challenge.type !== 'AI Image Recognition Challenge') {
      fs.unlinkSync(req.file.path);
      throw new HttpError(404, 'Active AI challenge not found.');
    }

    const scriptPath = path.join(__dirname, '../utils/analyze_image.py');
    const imagePath = req.file.path;

    return new Promise((resolve, reject) => {
      const pythonCommand = process.platform === 'win32' ? 'py' : 'python';
      const targetsArg = (challenge.aiDetectionTargets || []).join(',');
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
          const targets = (challenge.aiDetectionTargets || []).map(t => t.toLowerCase().trim());
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
              const originalTarget = (challenge.aiDetectionTargets || [])[matchedTargetIndex] || det.object;
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

          const expRewardMultiplier = detectedCount > 0 ? detectedCount : 1;
          const calculatedExpReward = challenge.expReward * expRewardMultiplier;
          const calculatedEcoCoins = challenge.ecoCoinReward * expRewardMultiplier;

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
                  detectedCount,
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
  challengeUploadMiddleware.single('image'),
  errorBoundary(async (req: AuthenticatedRequest, res) => {
    if (!isCycleActive()) {
      if (req.file && fs.existsSync(req.file.path)) {
        try { fs.unlinkSync(req.file.path); } catch {}
      }
      throw new HttpError(403, 'Challenges are disabled during weekends.');
    }
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
    if (!isCycleActive()) {
      throw new HttpError(403, 'Submitting new Before photos is only permitted during the active Monday to Friday cycle window.');
    }
    const payload = submissionSchema.parse(req.body);
    const instance = await resolveInstance(req.params.challengeInstanceId);
    const challenge = instance?.challenge;

    if (!challenge || !challenge.active) {
      throw new HttpError(404, 'Active challenge not found.');
    }

    const actualInstanceId = instance!.id;
    const requestedQuantity = payload.detectedQuantity || 1;

    // Atomically reserve quantity and create a new submission row
    const result = await prisma.$transaction(async (tx) => {
      // Lock and re-read challenge available quantity
      const freshChallenge = await tx.challenge.findUnique({
        where: { id: challenge.id }
      });

      if (!freshChallenge) {
        throw new HttpError(404, 'Challenge not found.');
      }

      if (freshChallenge.availableQuantity < requestedQuantity) {
        throw new HttpError(400, `Not enough items available in current cycle. Remaining available: ${freshChallenge.availableQuantity}`);
      }

      // Deduct from available quantity
      await tx.challenge.update({
        where: { id: challenge.id },
        data: {
          availableQuantity: { decrement: requestedQuantity }
        }
      });

      // Always create a new submission for multi-submission support
      const submission = await tx.challengeSubmission.create({
        data: {
          userId: req.auth!.userId,
          challengeInstanceId: actualInstanceId,
          proofText: payload.proofText,
          proofUrl: payload.proofUrl,
          detectedQuantity: requestedQuantity,
          reservedQuantity: requestedQuantity,
          status: 'pending',
        },
      });

      return submission;
    });

    return res.status(201).json({ submission: result });
  }),
);

challengeRoutes.post(
  '/:challengeInstanceId/verify-qr',
  authenticateRequest,
  requireUserAccess,
  errorBoundary(async (req: AuthenticatedRequest, res) => {
    const { qrData, latitude, longitude, submissionId } = req.body;
    const userId = req.auth!.userId;
    const instance = await resolveInstance(req.params.challengeInstanceId);
    const actualInstanceId = instance?.id || req.params.challengeInstanceId;

    if (!qrData) {
      throw new HttpError(400, 'QR data is required.');
    }

    let parsedQr: any;
    try {
      parsedQr = JSON.parse(qrData);
    } catch {
      throw new HttpError(400, 'Invalid QR code format.');
    }

    let submission;
    if (submissionId) {
      submission = await prisma.challengeSubmission.findUnique({
        where: { id: submissionId }
      });
    } else {
      // Find latest submission that is in approved_collection / preliminary approved status
      submission = await prisma.challengeSubmission.findFirst({
        where: {
          userId,
          challengeInstanceId: actualInstanceId,
        },
        orderBy: { createdAt: 'desc' }
      });
    }

    if (!submission) {
      throw new HttpError(404, 'Submission not found.');
    }

    if (submission.status !== 'approved_collection' && !submission.adminPreliminaryApproved) {
      throw new HttpError(400, 'Submission has not received preliminary Admin approval for collection.');
    }

    // Verify submission token or ID matches if specified
    if (parsedQr.subId && parsedQr.subId !== submission.id) {
      throw new HttpError(400, 'QR code does not match this challenge submission.');
    }

    const updated = await prisma.challengeSubmission.update({
      where: { id: submission.id },
      data: {
        qrVerified: true,
        qrVerifiedAt: new Date(),
        locationVerified: Boolean(latitude && longitude),
        locationVerifiedAt: latitude && longitude ? new Date() : null,
      }
    });

    return res.json({
      message: 'QR code verified successfully. You may now take your After Photo.',
      submission: updated
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
        where: { id: submissionId }
      });
    } else {
      submission = await prisma.challengeSubmission.findFirst({
        where: {
          userId,
          challengeInstanceId: actualInstanceId,
        },
        orderBy: { createdAt: 'desc' }
      });
    }

    if (!submission) {
      throw new HttpError(404, 'Submission not found.');
    }

    if (!submission.qrVerified) {
      throw new HttpError(400, 'You must scan and verify the collection QR code before submitting the After photo.');
    }

    const updated = await prisma.challengeSubmission.update({
      where: { id: submission.id },
      data: {
        afterProofUrl,
        status: 'final_review',
      }
    });

    return res.json({
      message: 'After photo submitted successfully! It is now pending final review.',
      submission: updated
    });
  }),
);

challengeRoutes.post(
  '/:challengeInstanceId/claim',
  authenticateRequest,
  requireUserAccess,
  errorBoundary(async (req: AuthenticatedRequest, res) => {
    const userId = req.auth!.userId;
    const instance = await resolveInstance(req.params.challengeInstanceId);
    const actualInstanceId = instance?.id || req.params.challengeInstanceId;

    const result = await gamificationService.claimChallenge(userId, actualInstanceId);

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
