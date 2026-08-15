const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'apps/api/src/routes/challengeRoutes.ts');
let content = fs.readFileSync(file, 'utf8');

// Add import
content = content.replace(
  "import { GamificationService } from '../services/GamificationService';",
  "import { GamificationService } from '../services/GamificationService';\nimport { getOrCreateActiveInstance } from '../services/cycleManagerService';"
);

// Replace /active route
const activeRoutePattern = /challengeRoutes\.get\([\s\S]*?\/active[\s\S]*?orderBy: \[\{ difficulty: 'asc' \}, \{ title: 'asc' \}\],\s*\}\);\s*return res\.json\(\{\s*items: challenges\.map\(\(challenge\) => \{[\s\S]*?\}\),\s*\}\);\s*\}\),\s*\);/m;

const newActiveRoute = `challengeRoutes.get(
  '/active',
  authenticateRequest,
  requireUserAccess,
  errorBoundary(async (req: AuthenticatedRequest, res) => {
    const userId = req.auth!.userId;
    const challengeTemplates = await prisma.challenge.findMany({
      where: { active: true },
      orderBy: [{ difficulty: 'asc' }, { title: 'asc' }],
    });

    const items = [];
    for (const challenge of challengeTemplates) {
      const instance = await getOrCreateActiveInstance(challenge.id);
      
      const userChallenge = await prisma.userChallenge.findUnique({
        where: { userId_challengeInstanceId: { userId, challengeInstanceId: instance.id } }
      });
      
      const submission = await prisma.challengeSubmission.findUnique({
        where: { userId_challengeInstanceId: { userId, challengeInstanceId: instance.id } }
      });

      let finalStatus = userChallenge?.status || 'not_started';
      if (submission && finalStatus !== 'COMPLETED') {
        finalStatus = submission.status;
      }

      items.push({
        ...challenge,
        cycle: {
          startDate: instance.startDate,
          endDate: instance.endDate,
          status: instance.status,
          instanceId: instance.id
        },
        progress: {
          progressPercentage: userChallenge?.progressPercentage || 0,
          status: finalStatus,
          rejectionReason: submission?.status === 'rejected' ? submission.moderatorNotes : undefined,
        },
      });
    }

    return res.json({ items });
  }),
);`;

content = content.replace(activeRoutePattern, newActiveRoute);

// Update /:challengeId/progress to expect challengeInstanceId in params
content = content.replace(
  `gamificationService.updateChallengeProgress(
      req.auth!.userId,
      req.params.challengeId,
      payload.progressPercentage,
    );`,
  `gamificationService.updateChallengeProgress(
      req.auth!.userId,
      req.params.challengeId, // this is now challengeInstanceId
      payload.progressPercentage,
    );`
);

// We need to change the route params from challengeId to challengeInstanceId for progress, analyze, upload-proof, submissions, claim
content = content.replace(/\/:challengeId\/progress/g, '/:challengeInstanceId/progress');
content = content.replace(/\/:challengeId\/analyze/g, '/:challengeInstanceId/analyze');
content = content.replace(/\/:challengeId\/upload-proof/g, '/:challengeInstanceId/upload-proof');
content = content.replace(/\/:challengeId\/submissions/g, '/:challengeInstanceId/submissions');
content = content.replace(/\/:challengeId\/claim/g, '/:challengeInstanceId/claim');

content = content.replace(/req\.params\.challengeId/g, 'req.params.challengeInstanceId');

// For /analyze, we need to fetch challenge template from instance
content = content.replace(
  `const challenge = await prisma.challenge.findUnique({
      where: { id: req.params.challengeInstanceId },
      select: {
        id: true,
        active: true,
        type: true,
        aiDetectionTargets: true,
        aiMinimumConfidence: true,
      },
    });`,
  `const instance = await prisma.challengeInstance.findUnique({
      where: { id: req.params.challengeInstanceId },
      include: { challenge: true }
    });
    const challenge = instance?.challenge;
    
    if (instance?.status !== 'OPEN') {
      throw new HttpError(400, 'Challenge cycle is currently closed.');
    }`
);

// For /submissions
content = content.replace(
  `const challenge = await prisma.challenge.findUnique({
      where: { id: req.params.challengeInstanceId },
      select: {
        id: true,
        active: true,
      },
    });`,
  `const instance = await prisma.challengeInstance.findUnique({
      where: { id: req.params.challengeInstanceId },
      include: { challenge: true }
    });
    const challenge = instance?.challenge;

    if (instance?.status !== 'OPEN') {
      throw new HttpError(400, 'Challenge cycle is closed.');
    }`
);

content = content.replace(
  `userId_challengeId: {
          userId: req.auth!.userId,
          challengeId: challenge.id,
        },`,
  `userId_challengeInstanceId: {
          userId: req.auth!.userId,
          challengeInstanceId: instance.id,
        },`
);

content = content.replace(
  `userId: req.auth!.userId,
        challengeId: challenge.id,
        proofText: payload.proofText,`,
  `userId: req.auth!.userId,
        challengeInstanceId: instance.id,
        proofText: payload.proofText,`
);

fs.writeFileSync(file, content, 'utf8');
console.log("Patched challengeRoutes.ts");
