import type { Response, NextFunction } from 'express';
import { prisma } from '../prismaClient';
import type { AuthenticatedRequest } from './authentication';

export async function requireApprovedId(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.auth) return res.status(401).json({ message: 'Please sign in.' });
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.auth.userId }, select: { idVerificationStatus: true },
    });
    if (user?.idVerificationStatus !== 'approved') {
      return res.status(403).json({ code: 'ID_APPROVAL_REQUIRED', message: 'ID approval is required to use this feature.' });
    }
    return next();
  } catch (error) { return next(error); }
}
