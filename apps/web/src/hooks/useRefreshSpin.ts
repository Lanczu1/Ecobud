import { useCallback, useState } from 'react';

/**
 * Tracks a Refresh button press, so its icon spins only for the refresh the admin asked for. Pages show
 * it only when no skeleton is on screen, so a screen never carries two loading indicators at once.
 */
export function useRefreshSpin() {
  const [spinning, setSpinning] = useState(false);
  const run = useCallback(async (task: () => unknown) => {
    setSpinning(true);
    try { await task(); } finally { setSpinning(false); }
  }, []);
  return [spinning, run] as const;
}
