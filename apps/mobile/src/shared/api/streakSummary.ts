import type { StreakSummary } from './ecobudApi';

const nonNegativeInteger = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;

export function isStreakSummary(value: unknown): value is StreakSummary {
  if (!value || typeof value !== 'object') return false;
  const data = value as Record<string, unknown>;
  return nonNegativeInteger(data.currentStreak) && typeof data.active === 'boolean'
    && nonNegativeInteger(data.restoresRemaining) && data.restoresRemaining <= 3
    && typeof data.canRestore === 'boolean' && (data.lastChallengeAt === null || typeof data.lastChallengeAt === 'string')
    && Array.isArray(data.milestones) && data.milestones.length > 0
    && data.milestones.every(item => item && typeof item === 'object'
      && nonNegativeInteger(item.challenges) && item.challenges > 0 && nonNegativeInteger(item.points)
      && nonNegativeInteger(item.ecoCoins) && typeof item.awarded === 'boolean'
      && (item.badge === null || typeof item.badge === 'string'));
}

export function parseStreakSummary(value: unknown): StreakSummary {
  if (!isStreakSummary(value)) throw new Error('Challenge streak rewards are unavailable right now. Please try again later.');
  return value;
}

export function isStreakFlameActive(count: number, active: boolean): boolean {
  return count >= 3 && active;
}
