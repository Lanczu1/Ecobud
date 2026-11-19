import { Router } from 'express';
import { authenticateRequest, AuthenticatedRequest } from '../http/authentication';
import { errorBoundary } from '../http/errorResponder';
import { TokenService } from '../security/tokenService';
import { WebSessionService } from '../security/webSessionService';

// Web dashboard session routes. Mounted outside /api/auth so these calls do not use up the
// per-IP login limit there.
export const webSessionRoutes = Router();

// The dashboard calls this while someone is clicking or typing, so a long stretch of work without
// any other API request does not reach the server's idle limit. authenticateRequest records the activity.
webSessionRoutes.post('/activity', authenticateRequest, (_req: AuthenticatedRequest, res) => {
  res.status(204).end();
});

// Logout and the browser's idle timeout. Ends this browser's session only, so the account stays
// signed in on mobile and in other browsers. Works for a token that has already idled out, and
// answers 204 whatever the token, so it reveals nothing about it.
webSessionRoutes.post('/logout', errorBoundary(async (req, res) => {
  const authorization = req.headers.authorization;
  if (authorization?.startsWith('Bearer ')) {
    try {
      const session = TokenService.verify(authorization.slice('Bearer '.length).trim());
      if (session.clientType === 'web' && session.sessionId) {
        await WebSessionService.revoke(session.sessionId, session.userId);
      }
    } catch {
      // Invalid or expired token: nothing to end.
    }
  }
  res.status(204).end();
}));
