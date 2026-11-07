import { Router } from 'express';
import { openResidentStream, streamSessionActive } from '../services/residentStream';
import { z } from 'zod';
import {
  authenticateRequest,
  AuthenticatedRequest,
  requireModeratorAccess,
  requireUserAccess,
} from '../http/authentication';
import { adminClientId, adminLiveEvents, type AdminLiveChange } from '../services/adminLiveEvents';
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

realtimeRoutes.get('/user-stream', authenticateRequest, requireUserAccess, openResidentStream);

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

    // Changes inside 250ms go out as one message: the screens they touch, and whether every one of them
    // came from this browser (which has then already reloaded what it changed).
    const client = adminClientId(req.header('x-admin-client'));
    let closed = false;
    let pending: NodeJS.Timeout | null = null;
    let sections: Set<string> | 'all' = new Set();
    let own = true;
    const send = (change: AdminLiveChange) => {
      if (closed) return;
      if (change.sections === 'all' || sections === 'all') sections = 'all';
      else for (const section of change.sections) sections.add(section);
      own = own && client !== null && change.origin === client;
      if (pending) return;
      pending = setTimeout(() => {
        pending = null;
        if (closed) return;
        const data = JSON.stringify({ sections: sections === 'all' ? 'all' : [...sections], own });
        void streamSessionActive(req).then(active => { if (!active) close(); else if (!closed) res.write(`data: ${data}\n\n`); });
        sections = new Set();
        own = true;
      }, 250);
    };
    const unsubscribe = adminLiveEvents.subscribe(send);
    const heartbeat = setInterval(() => { void streamSessionActive(req).then(active => { if (!active) close(); else if (!closed) res.write(': ping\n\n'); }); }, 15_000);
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
    res.once('close', close);
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
