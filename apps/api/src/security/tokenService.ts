import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'ecobud-local-development-secret';

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
