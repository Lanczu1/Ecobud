export function resolveLiveStreak(currentStreak: number, _lastActionDate?: Date | null): number {
  return Math.max(0, currentStreak);
}
