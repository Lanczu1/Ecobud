import jwt from 'jsonwebtoken';
import { randomBytes } from 'crypto';
import { z } from 'zod';

const DEFAULT_DEV_SECRET = 'ecobud-local-development-secret';
export const JWT_SECRET = process.env.JWT_SECRET || randomBytes(48).toString('hex');

if (process.env.NODE_ENV === 'production' && (!process.env.JWT_SECRET || JWT_SECRET.length < 32 || JWT_SECRET === DEFAULT_DEV_SECRET || /replace|your-|example|development/i.test(JWT_SECRET))) {
  throw new Error('JWT_SECRET must be a strong, unique secret of at least 32 characters in production.');
}

export type AccessRole = 'user' | 'moderator' | 'admin';
export type AccountStatus = 'active' | 'pending' | 'suspended';

export const roleRedirectMap: Record<AccessRole, string> = {
  user: '/app/dashboard',
  moderator: '/moderation',
  admin: '/admin',
};

export const getRoleRedirectPath = (role: AccessRole) => roleRedirectMap[role];

export interface TokenSession {
  userId: string;
  name: string;
  email: string;
  role: AccessRole;
  status: AccountStatus;
  city?: string | null;
  sessionVersion?: number;
}

const accessClaims = z.object({
  userId: z.string().min(1), name: z.string(), email: z.string().email(),
  role: z.enum(['user', 'moderator', 'admin']), status: z.enum(['active', 'pending', 'suspended']),
  city: z.string().nullable().optional(), sessionVersion: z.number().int().nonnegative(),
});

export const TokenService = {
  sign: (session: TokenSession) =>
    jwt.sign({ ...session, sessionVersion: session.sessionVersion ?? 0 }, JWT_SECRET, {
      algorithm: 'HS256', issuer: 'ecobud-api', audience: 'ecobud-access',
      expiresIn: '1h',
    }),
  verify: (token: string): TokenSession => accessClaims.parse(jwt.verify(token, JWT_SECRET, {
    algorithms: ['HS256'], issuer: 'ecobud-api', audience: 'ecobud-access',
  })),
};
