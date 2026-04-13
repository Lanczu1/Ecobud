import { Router } from 'express';
import {
  authenticateRequest,
  AuthenticatedRequest,
  requireUserAccess,
} from '../http/authentication';
import { errorBoundary } from '../http/errorResponder';
import { supabaseRealtimeService } from '../services/supabaseRealtimeService';
import { UserActivityService } from '../services/userActivityService';

const realtimeRoutes = Router();
const userActivityService = new UserActivityService();

realtimeRoutes.get(
  '/session',
  authenticateRequest,
  requireUserAccess,
  errorBoundary(async (req: AuthenticatedRequest, res) => {
    const auth = req.auth!;

    await userActivityService.touchUserActivity(auth.userId);
    await supabaseRealtimeService.publishAdminSectionBundle(['dashboard', 'users'], {
      actorRole: auth.role,
      actorUserId: auth.userId,
      entityId: auth.userId,
      reason: 'session-heartbeat',
    });

    return res.json(supabaseRealtimeService.getSession(auth.userId, auth.role));
  }),
);

export { realtimeRoutes };
