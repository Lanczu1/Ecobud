import { useEffect, useMemo, useState } from 'react';
import { AppState, DeviceEventEmitter } from 'react-native';
import { CursorFeed, type FeedPage } from './cursorFeed';

export function useCursorFeed<T extends { id: string }>(fetchPage: (cursor?: string) => Promise<FeedPage<T>>, eventName: string) {
  const feed = useMemo(() => new CursorFeed(fetchPage), [fetchPage]);
  const [snapshot, setSnapshot] = useState({ feed, state: feed.state });
  useEffect(() => {
    const unsubscribe = feed.subscribe(state => setSnapshot({ feed, state }));
    void feed.refresh();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let lastRefreshAt = Date.now();
    let dirty = false;
    const refresh = async () => {
      if (AppState.currentState !== 'active') { dirty = true; return; }
      dirty = false;
      await feed.refreshLoaded();
      lastRefreshAt = Date.now();
    };
    const changed = DeviceEventEmitter.addListener(eventName, () => {
      dirty = true;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => void refresh(), 450);
    });
    const appState = AppState.addEventListener('change', status => {
      if (status === 'active' && (dirty || Date.now() - lastRefreshAt >= 30_000)) void refresh();
    });
    const interval = setInterval(() => { if (Date.now() - lastRefreshAt >= 25_000) void refresh(); }, 30_000);
    return () => { unsubscribe(); changed.remove(); appState.remove(); clearInterval(interval); if (timer) clearTimeout(timer); };
  }, [feed, eventName]);
  return { ...(snapshot.feed === feed ? snapshot.state : feed.state), refresh: feed.refresh, loadMore: feed.loadMore, retry: feed.retry };
}
