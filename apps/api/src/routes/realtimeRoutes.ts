import { Router } from 'express';
import { z } from 'zod';
import {
  authenticateRequest,
  AuthenticatedRequest,
  requireModeratorAccess,
  requireUserAccess,
} from '../http/authentication';
import { adminLiveEvents } from '../services/adminLiveEvents';
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

const ADMIN_STREAM_MAX_MS = 10 * 60 * 1000;

// Server-sent change feed for the admin web app. The client reconnects (and re-authenticates) when it closes.
realtimeRoutes.get(
  '/admin-stream',
  authenticateRequest,
  requireModeratorAccess,
  (req: AuthenticatedRequest, res) => {
    res.status(200);
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();
    res.write('retry: 3000\n\n');

    let closed = false;
    let pending: NodeJS.Timeout | null = null;
    const send = () => {
      if (closed || pending) return;
      pending = setTimeout(() => {
        pending = null;
        if (!closed) res.write('data: change\n\n');
      }, 250);
    };
    const unsubscribe = adminLiveEvents.subscribe(send);
    const heartbeat = setInterval(() => { if (!closed) res.write(': ping\n\n'); }, 25_000);
    const close = () => {
      if (closed) return;
      closed = true;
      unsubscribe();
      clearInterval(heartbeat);
      clearTimeout(lifetime);
      if (pending) clearTimeout(pending);
      res.end();
    };
    const lifetime = setTimeout(close, ADMIN_STREAM_MAX_MS);
    req.on('close', close);
  },
);

realtimeRoutes.post(
  '/presence/connect',
  authenticateRequest,
  requireUserAccess,
  errorBoundary(async (req: AuthenticatedRequest, res) => {
    const auth = req.auth!;
    if (auth.role !== 'user') {
      return res.status(200).json({ presence: null });
    }
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
    if (auth.role !== 'user') {
      return res.status(200).json({ presence: null });
    }
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
    if (auth.role !== 'user') {
      return res.status(200).json({ presence: null });
    }
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
