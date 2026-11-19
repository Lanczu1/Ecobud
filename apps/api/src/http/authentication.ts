import { NextFunction, Request } from 'express';
import { Response } from 'express';
import { prisma } from '../prismaClient';
import { authCache } from '../lib/cache';
import { AccessRole, TokenService, TokenSession } from '../security/tokenService';
import { WebSessionService } from '../security/webSessionService';
import { JsonWebTokenError } from 'jsonwebtoken';
import { ZodError } from 'zod';

export interface AuthenticatedRequest extends Request {
  auth?: TokenSession;
  // Express 5 types allow string[] for wildcard params; no route here uses wildcards.
  params: Record<string, string>;
}

const AUTH_CACHE_SECONDS = 5;

const getInactiveStatusMessage =(status: TokenSession['status']) => {
  if (status === 'suspended') {
    return 'Your ECOBUD account is suspended. Please contact an administrator.';
  }

  return 'Your ECOBUD account is pending activation.';
};

const loadSessionUser = (userId: string) =>
  prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      status: true,
      sessionVersion: true,
      profile: {
        select: {
          city: true,
        },
      },
    },
  });

// The account row behind a session, shared with the sign-in check so a screen's requests reuse one lookup.
export const cachedSessionUser = (userId: string) =>
  authCache.getOrSet(`auth:${userId}`, AUTH_CACHE_SECONDS, () => loadSessionUser(userId));

// SECURITY: Every protected route runs this check first, so no route can accidentally be left open.
export const authenticateRequest = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) => {
  // SECURITY: The token is read only from the Authorization header, not the URL, so it never ends up in server logs or browser history.
  const authorization = req.headers.authorization;

  // SECURITY: A request with no token is turned away right away with a 401.
  if (!authorization?.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'A bearer token is required.' });
  }

  const token = authorization.replace('Bearer ', '').trim();

  try {
    // SECURITY: Only a token that this server signed and that hasn't expired gets past this point.
    const session = TokenService.verify(token);
    // SECURITY: a web token works only while its web session is open. Logout and the idle limit
    // close it. Web tokens issued before sessions existed have no id and must sign in again.
    if (session.clientType === 'web'
      && (!session.sessionId || !await WebSessionService.isActive(session.sessionId, session.userId, { touch: true }))) {
      return res.status(401).json({ message: 'Your session has ended. Please sign in again.' });
    }
    const cacheKey = `auth:${session.userId}`;
    const loadUser = () => loadSessionUser(session.userId);
    // A screen fires several requests at once; they share one lookup.
    let user = await authCache.getOrSet(cacheKey, AUTH_CACHE_SECONDS, loadUser);
    // A cached row can be a few seconds behind a password, email or status
    // change, so confirm against the database before turning anyone away.
    if (!user || user.status !== 'active' || session.sessionVersion !== user.sessionVersion
      || user.email.toLowerCase() !== session.email.toLowerCase()) {
      user = await loadUser();
      authCache.set(cacheKey, user, AUTH_CACHE_SECONDS);
    }

    if (!user) {
      return res.status(401).json({ message: 'The access token is no longer valid.' });
    }

    // SECURITY: Logout, password reset or enabling 2FA raises sessionVersion, which cancels every older token on every device, including stolen copies.
    if (session.sessionVersion !== user.sessionVersion || user.email.toLowerCase() !== session.email.toLowerCase()) {
      return res.status(401).json({ message: 'Session credentials have changed. Please log in again.' });
    }

    // SECURITY: A suspended account is blocked on its next request, even if its token hasn't expired.
    if (user.status !== 'active') {
      return res.status(403).json({ message: getInactiveStatusMessage(user.status) });
    }

    // SECURITY: The user's role and status come from the database, not the token, so nobody can give themselves admin rights by editing a token.
    req.auth = {
      userId: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status,
      city: user.profile?.city ?? null,
      sessionVersion: user.sessionVersion,
      clientType: session.clientType ?? 'mobile',
      authTime: session.authTime,
      sessionId: session.sessionId,
    };

    // SECURITY: The request reaches the route only after every check above has passed.
    return next();
  } catch (error) {
    // SECURITY: A bad token gets a plain 401 with no internal details that could help an attacker.
    if (error instanceof JsonWebTokenError || error instanceof ZodError) {
      return res.status(401).json({ message: 'The access token is invalid or expired.' });
    }
    return next(error);
  }
};

// SECURITY: role check, run after authenticateRequest. This server-side check is what protects admin
// and moderator routes; hiding screens in the web or mobile app is only cosmetic.
export const requireRoles =
  (...roles: AccessRole[]) =>
  (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.auth || !roles.includes(req.auth.role)) {
      return res.status(403).json({ message: 'You do not have access to this resource.' });
    }

    // SECURITY: staff-only routes (no 'user' in the list) accept web tokens only. A mobile token lasts
    // 30 days and renews to 90, so without this an admin password could buy months of admin access
    // that skips the web dashboard's 12-hour limit. Moderators keep using the resident app, whose
    // routes include 'user' and are unaffected.
    if (!roles.includes('user') && req.auth.clientType !== 'web') {
      return res.status(403).json({ message: 'Admin and moderator tools are only available from the web dashboard.' });
    }

    return next();
  };

export const requireUserAccess = requireRoles('user', 'moderator', 'admin');
export const requireModeratorAccess = requireRoles('moderator', 'admin');
export const requireAdminAccess = requireRoles('admin');
