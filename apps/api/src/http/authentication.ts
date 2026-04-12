import { NextFunction, Request } from 'express';
import { Response } from 'express';
import { prisma } from '../prismaClient';
import { AccessRole, TokenService, TokenSession } from '../security/tokenService';

export interface AuthenticatedRequest extends Request {
  auth?: TokenSession;
}

const getInactiveStatusMessage = (status: TokenSession['status']) => {
  if (status === 'suspended') {
    return 'Your ECOBUD account is suspended. Please contact an administrator.';
  }

  return 'Your ECOBUD account is pending activation.';
};

export const authenticateRequest = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) => {
  const authorization = req.headers.authorization;

  if (!authorization?.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'A bearer token is required.' });
  }

  const token = authorization.replace('Bearer ', '').trim();

  try {
    const session = TokenService.verify(token);
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
      },
    });

    if (!user) {
      return res.status(401).json({ message: 'The access token is no longer valid.' });
    }

    if (user.status !== 'active') {
      return res.status(403).json({ message: getInactiveStatusMessage(user.status) });
    }

    req.auth = {
      userId: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status,
    };

    return next();
  } catch {
    return res.status(401).json({ message: 'The access token is invalid or expired.' });
  }
};

export const requireRoles =
  (...roles: AccessRole[]) =>
  (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.auth || !roles.includes(req.auth.role)) {
      return res.status(403).json({ message: 'You do not have access to this resource.' });
    }

    return next();
  };

export const requireUserAccess = requireRoles('user', 'moderator', 'admin');
export const requireModeratorAccess = requireRoles('moderator', 'admin');
export const requireAdminAccess = requireRoles('admin');
