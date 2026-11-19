import jwt from 'jsonwebtoken';
import { randomBytes } from 'crypto';
import { z } from 'zod';

const DEFAULT_DEV_SECRET = 'ecobud-local-development-secret';
// SECURITY: This secret is the master key of every session, because anyone who knows it can make a valid token for any account, admins included.
// Changing it in production logs everyone out and breaks saved 2FA secrets (totp.ts derives its key from it).
export const JWT_SECRET = process.env.JWT_SECRET || randomBytes(48).toString('hex');

// SECURITY: refuse to start in production with a missing, short or placeholder secret.
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
  // Web tokens only: the web_sessions row that logout and the idle limit end.
  sessionId?: string;
}

const accessClaims = z.object({
  userId: z.string().min(1), name: z.string(), email: z.string().email(),
  role: z.enum(['user', 'moderator', 'admin']), status: z.enum(['active', 'pending', 'suspended']),
  city: z.string().nullable().optional(), sessionVersion: z.number().int().nonnegative(),
  clientType: z.enum(['mobile', 'web']).default('mobile'), authTime: z.number().int().positive().optional(),
  sessionId: z.string().min(1).max(64).optional(),
});

const refreshClaims = z.object({
  userId: z.string().min(1),
  sessionVersion: z.number().int().nonnegative(),
  clientType: z.literal('mobile'),
  authTime: z.number().int().positive(),
  tokenUse: z.literal('refresh'),
});

const mfaChallengeClaims = z.object({
  userId: z.string().min(1),
  challengeId: z.string().uuid(),
  clientType: z.enum(['mobile', 'web']),
  tokenUse: z.literal('mfa-challenge'),
});

export type MfaChallengeSession = z.infer<typeof mfaChallengeClaims>;

export type RefreshTokenSession = z.infer<typeof refreshClaims>;

// SECURITY: hard cap on a mobile session. Counted from authTime (the password login), so refreshing never extends it.
const MOBILE_REFRESH_LIFETIME_SECONDS = 90 * 24 * 60 * 60;

export const TokenService = {
  // SECURITY: This is the only place login tokens are created, so every token follows the same lifetime and signing rules.
  sign: (session: TokenSession) => {
    const clientType = session.clientType ?? 'mobile';
    const now = Math.floor(Date.now() / 1000);
    const authTime = session.authTime ?? now;
    // SECURITY: Admin web sessions expire after 12 hours (mobile 30 days), which limits how long a stolen admin token stays useful.
    const normalLifetime = clientType === 'mobile' ? 30 * 24 * 60 * 60 : 12 * 60 * 60;
    // Never past the hard cap: a mobile refresh on day 70 gets 20 days, not 30, because the cap is day 90.
    const absoluteExpiry = authTime + (clientType === 'mobile' ? MOBILE_REFRESH_LIFETIME_SECONDS : 12 * 60 * 60);
    const expiresIn = Math.max(1, Math.min(normalLifetime, absoluteExpiry - now));
    // SECURITY: The user's details are signed with the secret, so changing any value inside the token, such as the role, breaks the signature.
    return jwt.sign({ ...session, clientType, authTime, sessionVersion: session.sessionVersion ?? 0 }, JWT_SECRET, {
      // SECURITY: Marks this as an Ecobud login token, so it can't be confused with a refresh token, a 2FA token, or a token from another system.
      algorithm: 'HS256', issuer: 'ecobud-api', audience: 'ecobud-access',
      expiresIn,
    });
  },
  // SECURITY: Rejects tokens that are fake, expired, edited, unsigned ("alg: none") or meant for another purpose.
  verify: (token: string): TokenSession => accessClaims.parse(jwt.verify(token, JWT_SECRET, {
    algorithms: ['HS256'], issuer: 'ecobud-api', audience: 'ecobud-access',
  })),
  // Mobile only; web gets no refresh token, so an admin browser session cannot outlive 12 hours.
  // exp is fixed to login + 90 days. It only buys new access tokens through POST /api/auth/refresh,
  // which also re-checks the account's status and sessionVersion in the database.
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
  // Issued after a correct password when 2FA is on. Valid 5 minutes and only for the 2FA step;
  // it grants no API access by itself.
  signMfaChallenge: (challenge: Omit<MfaChallengeSession, 'tokenUse'>) => jwt.sign({
    ...challenge,
    tokenUse: 'mfa-challenge',
  }, JWT_SECRET, {
    algorithm: 'HS256', issuer: 'ecobud-api', audience: 'ecobud-mfa', expiresIn: '5m',
  }),
  verifyMfaChallenge: (token: string): MfaChallengeSession => mfaChallengeClaims.parse(jwt.verify(token, JWT_SECRET, {
    algorithms: ['HS256'], issuer: 'ecobud-api', audience: 'ecobud-mfa',
  })),
};
