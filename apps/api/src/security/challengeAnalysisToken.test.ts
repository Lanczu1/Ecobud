import { afterEach, expect, it, vi } from 'vitest';
import { detectionSettingsHash, signChallengeAnalysis, verifyChallengeAnalysis } from './challengeAnalysisToken';

const claims = { userId: 'alice', instanceId: 'challenge-week', proofUrl: 'https://example.com/photo.jpg', detectedCount: 1, settings: detectionSettingsHash(['Plastic Wrapper'], 80) };
afterEach(() => vi.useRealTimers());
it('accepts a server-issued detection result', () => {
  expect(verifyChallengeAnalysis(signChallengeAnalysis(claims), claims)).toEqual(claims);
});
it.each(['userId', 'instanceId', 'proofUrl', 'settings'] as const)('binds analysis to %s', field => {
  expect(() => verifyChallengeAnalysis(signChallengeAnalysis(claims), { ...claims, [field]: 'different' })).toThrow('Analyze');
});
it('rejects missing, forged and expired results', () => {
  vi.useFakeTimers();
  const token = signChallengeAnalysis(claims);
  expect(() => verifyChallengeAnalysis(undefined, claims)).toThrow();
  expect(() => verifyChallengeAnalysis(token + 'forged', claims)).toThrow();
  vi.advanceTimersByTime(16 * 60 * 1000);
  expect(() => verifyChallengeAnalysis(token, claims)).toThrow();
});
