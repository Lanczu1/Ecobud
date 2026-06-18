import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../prismaClient';
import { authenticateRequest, AuthenticatedRequest, requireUserAccess } from '../http/authentication';
import { errorBoundary, HttpError } from '../http/errorResponder';
import { GamificationService } from '../services/GamificationService';
import { challengeUploadMiddleware, analyzeUploadMiddleware } from '../http/uploadMiddleware';
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
    proofText: z.string().min(10).max(1000).optional(),
    proofUrl: z.string().optional(),
  })
  .refine((payload) => Boolean(payload.proofText ?? payload.proofUrl), {
    message: 'Provide proof text or a proof URL.',
    path: ['proofText'],
  });

challengeRoutes.get(
  '/active',
  authenticateRequest,
  requireUserAccess,
  errorBoundary(async (req: AuthenticatedRequest, res) => {
    const userId = req.auth!.userId;
    const challenges = await prisma.challenge.findMany({
      where: { active: true },
      include: {
        userChallenges: {
          where: { userId },
          take: 1,
        },
        submissions: {
          where: { userId },
          take: 1,
          orderBy: { createdAt: 'desc' },
        },
      },
      orderBy: [{ difficulty: 'asc' }, { title: 'asc' }],
    });

    return res.json({
      items: challenges.map((challenge) => {
        const userChallenge = challenge.userChallenges[0] ?? null;
        const submission = challenge.submissions[0] ?? null;
        let finalStatus = userChallenge?.status || 'not_started';
        if (submission) {
          // If the userChallenge is COMPLETED, it takes precedence. Otherwise use submission status.
          if (finalStatus !== 'COMPLETED') {
            finalStatus = submission.status; // pending, approved, rejected
          }
        }
        return {
          ...challenge,
          progress: {
            progressPercentage: userChallenge?.progressPercentage || 0,
            status: finalStatus,
          },
          submissions: undefined,
        };
      }),
    });
  }),
);

challengeRoutes.post(
  '/:challengeId/progress',
  authenticateRequest,
  requireUserAccess,
  errorBoundary(async (req: AuthenticatedRequest, res) => {
    const payload = progressSchema.parse(req.body);
    const result = await gamificationService.updateChallengeProgress(
      req.auth!.userId,
      req.params.challengeId,
      payload.progressPercentage,
    );

    return res.json(result);
  }),
);

challengeRoutes.post(
  '/:challengeId/analyze',
  authenticateRequest,
  requireUserAccess,
  analyzeUploadMiddleware.single('image'),
  errorBoundary(async (req: AuthenticatedRequest, res) => {
    if (!req.file) {
      throw new HttpError(400, 'Image file is required');
    }

    const challenge = await prisma.challenge.findUnique({
      where: { id: req.params.challengeId },
      select: {
        id: true,
        active: true,
        type: true,
        aiDetectionTargets: true,
        aiMinimumConfidence: true,
      },
    });

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
          const targets = (challenge.aiDetectionTargets || []).map(t => t.toLowerCase());
          const minConf = challenge.aiMinimumConfidence || 30;

          let passed = false;
          let matchedObject = 'Unknown';
          let matchedConfidence = 0;
          let reason = 'No matching object detected';

          for (const det of detected) {
            if (targets.includes(det.object.toLowerCase())) {
              if (det.confidence >= minConf) {
                passed = true;
                matchedObject = det.object;
                matchedConfidence = det.confidence;
                reason = '';
                break;
              } else if (!passed) {
                // Keep the highest confidence match that didn't meet the threshold
                if (det.confidence > matchedConfidence) {
                  matchedObject = det.object;
                  matchedConfidence = det.confidence;
                  reason = `Confidence ${det.confidence.toFixed(1)}% is below minimum ${minConf}%`;
                }
              }
            }
          }

          // If no targets were found at all
          if (!passed && matchedObject === 'Unknown') {
            reason = `No ${targets.join(' or ')} detected in the image`;
          }

          res.json({
            passed,
            object: matchedObject,
            confidence: Math.round(matchedConfidence),
            reason: passed ? undefined : reason,
            proofUrl: passed ? `/uploads/Challenges/AnalyzingImg/${req.file!.filename}` : undefined,
          });

          // Delete the image automatically if it failed to pass
          if (!passed) {
            import('fs').then(fs => {
              if (fs.existsSync(req.file!.path)) {
                fs.unlinkSync(req.file!.path);
              }
            });
          }

          resolve(undefined);
        } catch (err) {
          reject(new HttpError(500, 'Failed to parse YOLO analysis output'));
        }
      });
    });
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
        challenge: true,
        reviewer: {
          include: {
            profile: true,
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    return res.json({ items });
  }),
);

challengeRoutes.post(
  '/:challengeId/submissions',
  authenticateRequest,
  requireUserAccess,
  errorBoundary(async (req: AuthenticatedRequest, res) => {
    const payload = submissionSchema.parse(req.body);
    const challenge = await prisma.challenge.findUnique({
      where: { id: req.params.challengeId },
      select: {
        id: true,
        active: true,
      },
    });

    if (!challenge || !challenge.active) {
      throw new HttpError(404, 'Active challenge not found.');
    }

    const submission = await prisma.challengeSubmission.upsert({
      where: {
        userId_challengeId: {
          userId: req.auth!.userId,
          challengeId: challenge.id,
        },
      },
      update: {
        proofText: payload.proofText,
        proofUrl: payload.proofUrl,
        status: 'pending',
        moderatorNotes: null,
        flaggedReason: null,
        reviewedById: null,
        reviewedAt: null,
      },
      create: {
        userId: req.auth!.userId,
        challengeId: challenge.id,
        proofText: payload.proofText,
        proofUrl: payload.proofUrl,
      },
    });

    return res.status(201).json({ submission });
  }),
);

challengeRoutes.post(
  '/:challengeId/claim',
  authenticateRequest,
  requireUserAccess,
  errorBoundary(async (req: AuthenticatedRequest, res) => {
    const userId = req.auth!.userId;
    const challengeId = req.params.challengeId;

    const result = await gamificationService.claimChallenge(userId, challengeId);

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
      currentStreak: user?.currentStreak ?? 0,
      lastActionDate: user?.lastActionDate ?? null,
    });
  }),
);

export { challengeRoutes };
