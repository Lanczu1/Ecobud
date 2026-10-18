import { useCallback, useEffect, useState } from 'react';
import { ecobudApi, type StreakSummary } from '../../shared/api/ecobudApi';
import { isStreakSummary } from '../../shared/api/streakSummary';

export function useCurrentStreakSummary(token: string | undefined, cached: StreakSummary | undefined, enabled: boolean) {
  const [state, setState] = useState<{ token?: string; data: StreakSummary | null; error: string; loading: boolean }>(() => ({ token, data: isStreakSummary(cached) ? cached : null, error: '', loading: !isStreakSummary(cached) }));
  const [retry, setRetry] = useState(0);
  const refresh = useCallback(() => setRetry(value => value + 1), []);
  useEffect(() => {
    if (!enabled || !token) return;
    let alive = true;
    setState({ token, data: isStreakSummary(cached) ? cached : null, error: '', loading: !isStreakSummary(cached) });
    const load = async () => {
      try {
        const data = await ecobudApi.fetchStreak(token);
        if (alive) setState({ token, data, error: '', loading: false });
      } catch (cause) {
        if (alive) setState(current => ({ ...current, loading: false, error: cause instanceof Error ? cause.message : 'Unable to sync your streak.' }));
      }
    };
    void load();
    const timer = setInterval(() => void load(), 60000);
    return () => { alive = false; clearInterval(timer); };
  }, [token, cached, enabled, retry]);
  return { summary: state.token === token ? state.data : null, loading: state.loading, error: state.error, refresh };
}
