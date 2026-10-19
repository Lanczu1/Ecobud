export const STREAK_MILESTONES = [
  { challenges: 3, points: 30, ecoCoins: 0, badge: null },
  { challenges: 10, points: 100, ecoCoins: 5, badge: null },
  { challenges: 30, points: 300, ecoCoins: 15, badge: null },
  { challenges: 100, points: 1000, ecoCoins: 50, badge: null },
] as const;

export function streakMonth(now: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit' }).formatToParts(now);
  return `${parts.find(p => p.type === 'year')!.value}-${parts.find(p => p.type === 'month')!.value}`;
}

export const STREAK_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
export const STREAK_WARNING_MS = 2 * 24 * 60 * 60 * 1000;

export function streakLastActivity(user: { lastChallengeAt: Date | null; streakRestoredAt: Date | null }): number {
  return Math.max(user.lastChallengeAt?.getTime() ?? 0, user.streakRestoredAt?.getTime() ?? 0);
}

type StreakActivity = { currentStreak: number; lastChallengeAt: Date | null; streakRestoredAt: Date | null };

function manilaDay(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}

export function isStreakActive(user: StreakActivity, now = new Date()): boolean {
  const lastActivity = streakLastActivity(user);
  return user.currentStreak >= 1 && lastActivity > 0 && now.getTime() - lastActivity < STREAK_WINDOW_MS;
}

// An expired streak reads as 0. The stored count is kept so a restore can bring it back.
export function liveStreak(user: StreakActivity, now = new Date()): number {
  return isStreakActive(user, now) ? user.currentStreak : 0;
}

// Only the first completed challenge of a Manila calendar day adds to the streak.
// A challenge after the streak expired starts a new streak at 1.
export function nextChallengeStreak(user: StreakActivity, now = new Date()): number {
  if (!isStreakActive(user, now)) return 1;
  if (user.lastChallengeAt && manilaDay(user.lastChallengeAt) === manilaDay(now)) return user.currentStreak;
  return user.currentStreak + 1;
}

export function streakStatus(user: {
  currentStreak: number;
  lastChallengeAt: Date | null;
  streakRestoredAt: Date | null;
  streakRestoreMonth: string | null;
  streakRestoresUsed: number;
}, now = new Date()) {
  const active = isStreakActive(user, now);
  const restoresRemaining = Math.max(0, 3 - (user.streakRestoreMonth === streakMonth(now) ? user.streakRestoresUsed : 0));
  return { active, restoresRemaining, canRestore: user.currentStreak >= 1 && !active && restoresRemaining > 0 };
}
