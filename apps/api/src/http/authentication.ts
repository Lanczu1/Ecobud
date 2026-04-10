import { NextFunction, Request } from 'express';
import { Response } from 'express';
import { AccessRole, TokenService, TokenSession } from '../security/tokenService';

export interface AuthenticatedRequest extends Request {
  auth?: TokenSession;
}

export const authenticateRequest = (
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
    req.auth = TokenService.verify(token);
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
