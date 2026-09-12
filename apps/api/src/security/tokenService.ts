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
export type SessionClient = 'mobile' | 'web';

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
  clientType?: SessionClient;
  authTime?: number;
}

const accessClaims = z.object({
  userId: z.string().min(1), name: z.string(), email: z.string().email(),
  role: z.enum(['user', 'moderator', 'admin']), status: z.enum(['active', 'pending', 'suspended']),
  city: z.string().nullable().optional(), sessionVersion: z.number().int().nonnegative(),
  clientType: z.enum(['mobile', 'web']).default('mobile'), authTime: z.number().int().positive().optional(),
});

const refreshClaims = z.object({
  userId: z.string().min(1),
  sessionVersion: z.number().int().nonnegative(),
  clientType: z.literal('mobile'),
  authTime: z.number().int().positive(),
  tokenUse: z.literal('refresh'),
});

export type RefreshTokenSession = z.infer<typeof refreshClaims>;

const MOBILE_REFRESH_LIFETIME_SECONDS = 90 * 24 * 60 * 60;

export const TokenService = {
  sign: (session: TokenSession) => {
    const clientType = session.clientType ?? 'mobile';
    const now = Math.floor(Date.now() / 1000);
    const authTime = session.authTime ?? now;
    const normalLifetime = clientType === 'mobile' ? 30 * 24 * 60 * 60 : 12 * 60 * 60;
    const absoluteExpiry = authTime + (clientType === 'mobile' ? MOBILE_REFRESH_LIFETIME_SECONDS : 12 * 60 * 60);
    const expiresIn = Math.max(1, Math.min(normalLifetime, absoluteExpiry - now));
    return jwt.sign({ ...session, clientType, authTime, sessionVersion: session.sessionVersion ?? 0 }, JWT_SECRET, {
      algorithm: 'HS256', issuer: 'ecobud-api', audience: 'ecobud-access',
      expiresIn,
    });
  },
  verify: (token: string): TokenSession => accessClaims.parse(jwt.verify(token, JWT_SECRET, {
    algorithms: ['HS256'], issuer: 'ecobud-api', audience: 'ecobud-access',
  })),
  signRefresh: (session: Pick<TokenSession, 'userId' | 'sessionVersion' | 'authTime'>) => {
    const authTime = session.authTime ?? Math.floor(Date.now() / 1000);
    return jwt.sign({
      userId: session.userId,
      sessionVersion: session.sessionVersion ?? 0,
      clientType: 'mobile',
      authTime,
      tokenUse: 'refresh',
      exp: authTime + MOBILE_REFRESH_LIFETIME_SECONDS,
    }, JWT_SECRET, {
      algorithm: 'HS256', issuer: 'ecobud-api', audience: 'ecobud-refresh',
    });
  },
  verifyRefresh: (token: string): RefreshTokenSession => refreshClaims.parse(jwt.verify(token, JWT_SECRET, {
    algorithms: ['HS256'], issuer: 'ecobud-api', audience: 'ecobud-refresh',
  })),
};
