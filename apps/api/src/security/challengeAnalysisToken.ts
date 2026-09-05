import jwt from 'jsonwebtoken';
import { createHash } from 'crypto';
import { z } from 'zod';
import { JWT_SECRET } from './tokenService';
import { HttpError } from '../http/errorResponder';

const claimsSchema = z.object({ userId: z.string(), instanceId: z.string(), proofUrl: z.string().url(), settings: z.string(), detectedCount: z.number().int().min(1).max(300) });
type Claims = z.infer<typeof claimsSchema>;
export const detectionSettingsHash = (targets: unknown, minimum: number | null) => createHash('sha256').update(JSON.stringify([targets, minimum])).digest('hex');
export const signChallengeAnalysis = (claims: Claims) => jwt.sign(claims, JWT_SECRET, { algorithm: 'HS256', expiresIn: '15m', audience: 'challenge-analysis', issuer: 'ecobud-api' });
export function verifyChallengeAnalysis(token: string | undefined, expected: Omit<Claims, 'detectedCount'>) {
  try {
    if (!token) throw new Error();
    const claims = claimsSchema.parse(jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'], audience: 'challenge-analysis', issuer: 'ecobud-api' }));
    if (claims.userId !== expected.userId || claims.instanceId !== expected.instanceId || claims.proofUrl !== expected.proofUrl || claims.settings !== expected.settings) throw new Error();
    return claims;
  } catch {
    throw new HttpError(400, 'Analyze this before photo again before submitting it.');
  }
}
