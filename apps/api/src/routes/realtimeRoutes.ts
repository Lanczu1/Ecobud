import { Router } from 'express';
import { z } from 'zod';
import {
  authenticateRequest,
  AuthenticatedRequest,
  requireUserAccess,
} from '../http/authentication';
import { errorBoundary } from '../http/errorResponder';
import { presenceService } from '../services/presenceService';
import { supabaseRealtimeService } from '../services/supabaseRealtimeService';

const realtimeRoutes = Router();
const presenceSchema = z.object({
  sessionId: z.string().min(1).max(255).optional(),
  appState: z.enum(['active', 'background', 'inactive']),
  connectionState: z.enum(['online', 'offline', 'reconnecting', 'stale']),
});

realtimeRoutes.get(
  '/session',
  authenticateRequest,
  requireUserAccess,
  errorBoundary(async (req: AuthenticatedRequest, res) => {
    const auth = req.auth!;
    return res.json(supabaseRealtimeService.getSession(auth.userId, auth.role));
  }),
);

realtimeRoutes.post(
  '/presence/connect',
  authenticateRequest,
  requireUserAccess,
  errorBoundary(async (req: AuthenticatedRequest, res) => {
    const auth = req.auth!;
    const payload = presenceSchema.parse(req.body);
    const presence = await presenceService.connectSession(
      {
        userId: auth.userId,
        sessionId: payload.sessionId,
        appState: payload.appState,
        connectionState: payload.connectionState,
      },
      {
        actorRole: auth.role,
        actorUserId: auth.userId,
        entityId: auth.userId,
        reason: 'presence-connected',
      },
    );

    return res.status(200).json({ presence });
  }),
);

realtimeRoutes.post(
  '/presence/heartbeat',
  authenticateRequest,
  requireUserAccess,
  errorBoundary(async (req: AuthenticatedRequest, res) => {
    const auth = req.auth!;
    const payload = presenceSchema.parse(req.body);
    const presence = await presenceService.heartbeatSession(
      {
        userId: auth.userId,
        sessionId: payload.sessionId,
        appState: payload.appState,
        connectionState: payload.connectionState,
      },
      {
        actorRole: auth.role,
        actorUserId: auth.userId,
        entityId: auth.userId,
        reason: 'presence-heartbeat',
      },
    );

    return res.status(200).json({ presence });
  }),
);

realtimeRoutes.post(
  '/presence/disconnect',
  authenticateRequest,
  requireUserAccess,
  errorBoundary(async (req: AuthenticatedRequest, res) => {
    const auth = req.auth!;
    const payload = presenceSchema.parse(req.body);
    const presence = await presenceService.disconnectSession(
      {
        userId: auth.userId,
        sessionId: payload.sessionId,
        appState: payload.appState,
        connectionState: payload.connectionState,
      },
      {
        actorRole: auth.role,
        actorUserId: auth.userId,
        entityId: auth.userId,
        reason: 'presence-disconnected',
      },
    );

    return res.status(200).json({ presence });
  }),
);

export { realtimeRoutes };
