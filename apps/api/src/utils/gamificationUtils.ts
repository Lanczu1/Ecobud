import { liveStreak } from './streakRules';

export function resolveLiveStreak(user: { currentStreak: number; lastChallengeAt: Date | null; streakRestoredAt: Date | null }): number {
  return Math.max(0, liveStreak(user));
}
