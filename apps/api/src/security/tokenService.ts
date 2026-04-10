import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'ecobud-local-development-secret';

export type AccessRole = 'USER' | 'MODERATOR' | 'ADMIN';

export interface TokenSession {
  userId: string;
  email: string;
  role: AccessRole;
}

export const TokenService = {
  sign: (session: TokenSession) =>
    jwt.sign(session, JWT_SECRET, {
      expiresIn: '7d',
    }),
  verify: (token: string) => jwt.verify(token, JWT_SECRET) as TokenSession,
};
