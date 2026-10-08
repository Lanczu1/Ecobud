import { useEffect, useLayoutEffect, useRef } from 'react';
import { adminRealtimeService } from '../services/adminRealtimeService';

/** Runs `refresh` on every server push, on the fallback poll, and when the tab regains focus or connectivity. */
export function useAdminLiveRefresh(refresh: () => void, enabled = true) {
  const refreshRef = useRef(refresh);
  useLayoutEffect(() => { refreshRef.current = refresh; });
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    let disconnect: (() => void) | undefined;
    void adminRealtimeService.connect({ onContentRefresh: () => refreshRef.current() }).then(stop => {
      if (alive) disconnect = stop; else stop();
    });
    return () => { alive = false; disconnect?.(); };
  }, [enabled]);
}
