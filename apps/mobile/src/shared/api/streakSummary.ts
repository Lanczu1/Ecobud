import type { StreakSummary } from './ecobudApi';

const nonNegativeInteger = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;

export function isStreakSummary(value: unknown): value is StreakSummary {
  if (!value || typeof value !== 'object') return false;
  const data = value as Record<string, unknown>;
  return nonNegativeInteger(data.currentStreak) && (data.savedStreak === undefined || nonNegativeInteger(data.savedStreak))
    && typeof data.active === 'boolean'
    && nonNegativeInteger(data.restoresRemaining) && data.restoresRemaining <= 3
    && typeof data.canRestore === 'boolean' && (data.lastChallengeAt === null || typeof data.lastChallengeAt === 'string')
    && (data.expiresAt === undefined || data.expiresAt === null || (typeof data.expiresAt === 'string' && Number.isFinite(Date.parse(data.expiresAt))))
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

export const STREAK_FLAME_MINIMUM = 3;

export function isStreakFlameActive(count: number, active: boolean): boolean {
  return count >= STREAK_FLAME_MINIMUM && active;
}

// The count a restore would bring back; older API responses only send currentStreak.
export function savedStreakCount(summary: Pick<StreakSummary, 'currentStreak' | 'savedStreak'> | null | undefined): number {
  return summary?.savedStreak ?? summary?.currentStreak ?? 0;
}

export function crossedStreakMilestone(previous: number | null, current: number): boolean {
  // The streak grows by at most 1 a day, so a jump from 0 is a restore, not a new milestone.
  if (previous === null || (previous === 0 && current > 1)) return false;
  return [1, 3, 10, 30, 100].some(milestone => previous < milestone && current >= milestone);
}

export function streakExpiry(summary: Pick<StreakSummary, 'currentStreak' | 'active' | 'expiresAt'> | null | undefined, now = Date.now()) {
  const expiresAt = summary?.expiresAt ? Date.parse(summary.expiresAt) : NaN;
  const remainingMs = Number.isFinite(expiresAt) ? expiresAt - now : null;
  const unlocked = (summary?.currentStreak ?? 0) >= 1;
  const expired = unlocked && remainingMs !== null && remainingMs <= 0;
  const active = unlocked && Boolean(summary?.active) && !expired;
  const warning = active && remainingMs !== null && remainingMs > 0 && remainingMs <= 48 * 60 * 60 * 1000;
  return { active, expired, warning, remainingMs };
}

export function formatStreakTimeLeft(remainingMs: number) {
  if (remainingMs < 60000) return 'Less than a minute left';
  const minutes = Math.ceil(remainingMs / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const parts: string[] = [];
  if (days) parts.push(`${days} ${days === 1 ? 'day' : 'days'}`);
  if (hours % 24) parts.push(`${hours % 24} ${hours % 24 === 1 ? 'hour' : 'hours'}`);
  if (!days && minutes % 60) parts.push(`${minutes % 60} ${minutes % 60 === 1 ? 'minute' : 'minutes'}`);
  return `${parts.join(' ')} left`;
}

export function streakCountdownParts(remainingMs: number) {
  const total = Math.max(0, Math.ceil(remainingMs / 1000));
  return { days: Math.floor(total / 86400), hours: Math.floor(total / 3600) % 24, minutes: Math.floor(total / 60) % 60, seconds: total % 60 };
}
