import { useEffect, useLayoutEffect, useRef } from 'react';
import { adminRealtimeService, type AdminChangeSection } from '../services/adminRealtimeService';

/**
 * Runs `refresh` on server pushes for the given sections (every push when left out), on the fallback
 * poll, and when the tab returns after the live stream was down.
 */
export function useAdminLiveRefresh(refresh: () => void, enabled = true, sections?: AdminChangeSection[]) {
  const refreshRef = useRef(refresh);
  useLayoutEffect(() => { refreshRef.current = refresh; });
  const sectionKey = sections?.join(',');
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    let disconnect: (() => void) | undefined;
    const wanted = sectionKey ? sectionKey.split(',') as AdminChangeSection[] : undefined;
    void adminRealtimeService.connect({ sections: wanted, onContentRefresh: () => refreshRef.current() }).then(stop => {
      if (alive) disconnect = stop; else stop();
    });
    return () => { alive = false; disconnect?.(); };
  }, [enabled, sectionKey]);
}
