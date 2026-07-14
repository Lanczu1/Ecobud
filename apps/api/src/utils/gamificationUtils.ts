export function resolveLiveStreak(currentStreak: number, lastActionDate: Date | null | undefined): number {
  if (!lastActionDate || currentStreak === 0) return 0;
  
  const today = new Date().toISOString().slice(0, 10);
  const lastActionDay = lastActionDate.toISOString().slice(0, 10);
  
  if (today === lastActionDay) {
    return currentStreak;
  }
  
  const yesterdayDate = new Date();
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterdayDay = yesterdayDate.toISOString().slice(0, 10);
  
  if (lastActionDay === yesterdayDay) {
    return currentStreak;
  }
  
  return 0; // Streak was broken
}
