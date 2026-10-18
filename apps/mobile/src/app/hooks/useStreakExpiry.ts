import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import type { StreakSummary } from '../../shared/api/ecobudApi';
import { streakExpiry } from '../../shared/api/streakSummary';

export function useStreakExpiry(summary: StreakSummary | null | undefined) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const update = () => setNow(Date.now());
    update();
    const interval = setInterval(() => {
      if (AppState.currentState === 'active') update();
    }, 15000);
    const deadline = summary?.expiresAt ? Date.parse(summary.expiresAt) : NaN;
    const transitions = [48 * 3600000, 24 * 3600000, 0]
      .map(threshold => deadline - Date.now() - threshold)
      .filter(delay => delay > 0 && delay < 2147483647)
      .map(delay => setTimeout(() => { if (AppState.currentState === 'active') update(); }, delay + 1));
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') update();
    });
    return () => { clearInterval(interval); transitions.forEach(clearTimeout); subscription.remove(); };
  }, [summary?.expiresAt]);
  return streakExpiry(summary, now);
}
