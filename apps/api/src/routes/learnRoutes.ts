import { Router } from 'express';
import { learnController } from '../controllers/learnController';
import { authenticateRequest, requireUserAccess } from '../http/authentication';
import { errorBoundary } from '../http/errorResponder';

const learnRoutes = Router();

learnRoutes.get(
  '/lessons',
  authenticateRequest,
  requireUserAccess,
  errorBoundary(learnController.getLessons),
);

learnRoutes.post(
  '/seen',
  authenticateRequest,
  requireUserAccess,
  errorBoundary(learnController.markSeen),
);

learnRoutes.post(
  '/complete',
  authenticateRequest,
  requireUserAccess,
  errorBoundary(learnController.completeLesson),
);

export { learnRoutes };
