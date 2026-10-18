import { Router } from 'express';
import { z } from 'zod';
import { authenticateRequest, type AuthenticatedRequest, requireUserAccess, requireModeratorAccess } from '../http/authentication';
import { errorBoundary } from '../http/errorResponder';
import { approveChallengePhotoDeletion, listChallengePhotoDeletionRequests, requestChallengePhotoDeletion, requestChallengePhotosDeletion } from '../services/challengePhotoDeletion';
import { parseAdminPagination } from '../utils/adminPagination';
import { adminLiveEvents } from '../services/adminLiveEvents';
import { supabaseRealtimeService } from '../services/supabaseRealtimeService';

export const challengePhotoDeletionRoutes = Router();
const photoUrl = z.string().trim().min(1).max(2048);
const schema = z.discriminatedUnion('photoField', [
  z.object({ reason: z.string().trim().min(5).max(500), photoUrl, photoField: z.enum(['proofUrl', 'afterProofUrl']) }),
  z.object({ reason: z.string().trim().min(5).max(500), photoField: z.literal('both'), photos: z.object({ proofUrl: photoUrl.nullable(), afterProofUrl: photoUrl.nullable() }).refine(photos => !!photos.proofUrl || !!photos.afterProofUrl) }),
]);
challengePhotoDeletionRoutes.post('/submissions/:submissionId/delete-request', authenticateRequest, requireUserAccess, errorBoundary(async (req: AuthenticatedRequest, res) => {
  const body = schema.parse(req.body);
  const result = body.photoField === 'both'
    ? await requestChallengePhotosDeletion(req.auth!.userId, req.params.submissionId, body.reason, body.photos)
    : await requestChallengePhotoDeletion(req.auth!.userId, req.params.submissionId, body.photoField, body.reason, body.photoUrl);
  adminLiveEvents.emit(['challenges']);
  void supabaseRealtimeService.publishUserSectionRefresh(req.auth!.userId, 'challenges', { reason: 'challenge-photo-delete-requested' });
  res.json(result);
}));

export const adminChallengePhotoDeletionRoutes = Router();
adminChallengePhotoDeletionRoutes.use(authenticateRequest, requireModeratorAccess);
adminChallengePhotoDeletionRoutes.get('/', errorBoundary(async (req: AuthenticatedRequest, res) => {
  const { page, pageSize } = parseAdminPagination(req.query);
  const status = z.enum(['pending', 'approved']).parse(req.query.status ?? 'pending');
  res.json(await listChallengePhotoDeletionRequests(req.auth!, status, page, pageSize));
}));
adminChallengePhotoDeletionRoutes.post('/:requestId/approve', errorBoundary(async (req: AuthenticatedRequest, res) => {
  const result = await approveChallengePhotoDeletion(req.auth!, req.params.requestId);
  adminLiveEvents.emit(['challenges']);
  if (result.userId) void supabaseRealtimeService.publishUserSectionRefresh(result.userId, 'challenges', { entityId: result.challengeInstanceId, reason: 'challenge-photo-delete-approved' });
  res.json({ success: true, alreadyApproved: result.alreadyApproved });
}));
