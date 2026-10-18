import { Router } from 'express';
import { z } from 'zod';
import { authenticateRequest, type AuthenticatedRequest, requireUserAccess, requireModeratorAccess } from '../http/authentication';
import { errorBoundary } from '../http/errorResponder';
import { approveEventPhotoDeletion, listEventPhotoDeletionRequests, requestEventPhotoDeletion } from '../services/eventPhotoDeletion';
import { parseAdminPagination } from '../utils/adminPagination';
import { adminLiveEvents } from '../services/adminLiveEvents';
import { supabaseRealtimeService } from '../services/supabaseRealtimeService';

export const eventPhotoDeletionRoutes = Router();
const requestSchema = z.object({ reason: z.string().trim().min(5).max(500), photoUrl: z.string().trim().min(1).max(2048) });
eventPhotoDeletionRoutes.post('/submissions/:submissionId/delete-request', authenticateRequest, requireUserAccess, errorBoundary(async (req: AuthenticatedRequest, res) => {
  const body = requestSchema.parse(req.body);
  const result = await requestEventPhotoDeletion(req.auth!.userId, req.params.submissionId, body.reason, body.photoUrl);
  adminLiveEvents.emit(['events']);
  void supabaseRealtimeService.publishUserEventsRefresh(req.auth!.userId, { reason: 'event-photo-delete-requested' });
  res.json(result);
}));

export const adminEventPhotoDeletionRoutes = Router();
adminEventPhotoDeletionRoutes.use(authenticateRequest, requireModeratorAccess);
adminEventPhotoDeletionRoutes.get('/', errorBoundary(async (req: AuthenticatedRequest, res) => {
  const { page, pageSize } = parseAdminPagination(req.query);
  const status = z.enum(['pending', 'approved']).parse(req.query.status ?? 'pending');
  res.json(await listEventPhotoDeletionRequests(req.auth!, status, page, pageSize));
}));
adminEventPhotoDeletionRoutes.post('/:requestId/approve', errorBoundary(async (req: AuthenticatedRequest, res) => {
  const result = await approveEventPhotoDeletion(req.auth!, req.params.requestId);
  adminLiveEvents.emit(['events']);
  if (result.userId) void supabaseRealtimeService.publishUserEventsRefresh(result.userId, { entityId: result.eventId, reason: 'event-photo-delete-approved' });
  res.json({ success: true, alreadyApproved: result.alreadyApproved });
}));
