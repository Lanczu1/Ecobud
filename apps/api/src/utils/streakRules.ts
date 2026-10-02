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

export function streakStatus(user: {
  currentStreak: number;
  lastChallengeAt: Date | null;
  streakRestoredAt: Date | null;
  streakRestoreMonth: string | null;
  streakRestoresUsed: number;
}, now = new Date()) {
  const lastActivity = Math.max(user.lastChallengeAt?.getTime() ?? 0, user.streakRestoredAt?.getTime() ?? 0);
  const active = user.currentStreak >= 3 && lastActivity > 0 && now.getTime() - lastActivity < 7 * 24 * 60 * 60 * 1000;
  const restoresRemaining = Math.max(0, 3 - (user.streakRestoreMonth === streakMonth(now) ? user.streakRestoresUsed : 0));
  return { active, restoresRemaining, canRestore: user.currentStreak >= 3 && !active && restoresRemaining > 0 };
}
