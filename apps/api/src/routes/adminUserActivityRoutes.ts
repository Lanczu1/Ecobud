import { Router } from 'express';
import { requireAdminAccess, AuthenticatedRequest } from '../http/authentication';
import { errorBoundary } from '../http/errorResponder';
import { getAdminUserActivity } from '../services/adminUserActivity';

export const adminUserActivityRoutes = Router();
adminUserActivityRoutes.use(requireAdminAccess);
adminUserActivityRoutes.get('/', errorBoundary<AuthenticatedRequest>(async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.json(await getAdminUserActivity(req.auth!, req.query));
}));
