export const HOME_REFRESH_INTERVAL_MS = 60_000;
export type HomeResource = 'dashboard' | 'habits' | 'lessons' | 'challenges' | 'events' | 'leaderboard';
export const HOME_RESOURCES: HomeResource[] = ['dashboard', 'habits', 'lessons', 'challenges', 'events', 'leaderboard'];

export function affectedHomeResources(channel: string, reason = ''): HomeResource[] {
  if (reason === 'reward' || reason === 'redeem' || reason === 'badge') return ['dashboard', 'leaderboard'];
  if (channel === 'events' || reason.startsWith('event-') || reason === 'event') return ['events', 'dashboard', 'leaderboard'];
  if (channel === 'tracker' || reason === 'habit-check-in' || reason === 'habit') return ['habits', 'dashboard', 'leaderboard'];
  if (channel === 'learn' || reason === 'lesson') return ['lessons', 'dashboard', 'leaderboard'];
  if (channel === 'challenges' || channel === 'challenge' || reason === 'challenge') return ['challenges', 'dashboard', 'leaderboard'];
  return [];
}
