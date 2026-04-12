import { Router } from 'express';
import { userStatsController } from '../controllers/userStatsController';
import { authenticateRequest, requireUserAccess } from '../http/authentication';
import { errorBoundary } from '../http/errorResponder';

const userActionRoutes = Router();

userActionRoutes.post(
  '/reset-knowledge',
  authenticateRequest,
  requireUserAccess,
  errorBoundary(userStatsController.resetKnowledgePoints),
);

export { userActionRoutes };
