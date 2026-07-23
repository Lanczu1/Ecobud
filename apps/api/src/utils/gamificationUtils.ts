export function resolveLiveStreak(currentStreak: number, lastActionDate: Date | null | undefined): number {
  if (!lastActionDate || currentStreak === 0) return 0;
  
  const getPhDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Manila',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(date);
  };
  
  const today = getPhDate(new Date());
  const lastActionDay = getPhDate(lastActionDate);
  
  if (today === lastActionDay) {
    return currentStreak;
  }
  
  const yesterdayDate = new Date();
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterdayDay = getPhDate(yesterdayDate);
  
  if (lastActionDay === yesterdayDay) {
    return currentStreak;
  }
  
  return 0; // Streak was broken
}
