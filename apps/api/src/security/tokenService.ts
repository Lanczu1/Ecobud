import jwt from 'jsonwebtoken';

const DEFAULT_DEV_SECRET = 'ecobud-local-development-secret';
const JWT_SECRET = process.env.JWT_SECRET || DEFAULT_DEV_SECRET;

if (process.env.NODE_ENV === 'production' && (!process.env.JWT_SECRET || process.env.JWT_SECRET === DEFAULT_DEV_SECRET)) {
  console.error('🚨 [CRITICAL SECURITY ERROR]: JWT_SECRET must be explicitly set to a strong secret in production!');
  if (!process.env.ALLOW_INSECURE_SECRET) {
    throw new Error('Fatal: Insecure JWT_SECRET in production environment.');
  }
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
}

export const TokenService = {
  sign: (session: TokenSession) =>
    jwt.sign(session, JWT_SECRET, {
      expiresIn: '7d',
    }),
  verify: (token: string) => jwt.verify(token, JWT_SECRET) as TokenSession,
};
