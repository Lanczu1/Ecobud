import { Router } from 'express';
import { homeController } from '../controllers/homeController';
import { authenticateRequest, requireUserAccess } from '../http/authentication';
import { errorBoundary } from '../http/errorResponder';

const homeRoutes = Router();

homeRoutes.get(
  '/dashboard',
  authenticateRequest,
  requireUserAccess,
  errorBoundary(homeController.getDashboard),
);

export { homeRoutes };
