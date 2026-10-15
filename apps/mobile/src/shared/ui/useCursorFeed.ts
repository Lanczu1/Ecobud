import { useEffect, useMemo, useState } from 'react';
import { AppState, DeviceEventEmitter } from 'react-native';
import { CursorFeed, type FeedPage } from './cursorFeed';

// Last loaded page set per feed key, kept for the app session so switching back to a tab
// shows its list straight away while a background refresh brings it up to date.
type CachedFeed = FeedPage<any> & { at: number };
const feedCache = new Map<string, CachedFeed>();
const prefetching = new Set<string>();
const FRESH_MS = 15_000;
const watchedEvents = new Set<string>();

// A change event makes every cached feed for it stale, including tabs that are not on screen.
function invalidateOn(eventName: string) {
  if (watchedEvents.has(eventName)) return;
  watchedEvents.add(eventName);
  DeviceEventEmitter.addListener(eventName, () => {
    for (const [key, entry] of feedCache) if (key.startsWith(`${eventName}:`)) entry.at = 0;
  });
}

/** Loads a feed's first page into the cache ahead of time, unless it is already there. */
export function prefetchCursorFeed<T extends { id: string }>(cacheKey: string, fetchPage: (cursor?: string) => Promise<FeedPage<T>>) {
  if (feedCache.has(cacheKey) || prefetching.has(cacheKey)) return;
  prefetching.add(cacheKey);
  fetchPage()
    .then(page => { if (!feedCache.has(cacheKey)) feedCache.set(cacheKey, { ...page, at: Date.now() }); })
    .catch(() => {})
    .finally(() => prefetching.delete(cacheKey));
}

export function useCursorFeed<T extends { id: string }>(fetchPage: (cursor?: string) => Promise<FeedPage<T>>, eventName: string, cacheKey?: string) {
  invalidateOn(eventName);
  const feed = useMemo(() => {
    const created = new CursorFeed(fetchPage);
    const cached = cacheKey ? feedCache.get(cacheKey) : undefined;
    if (cached) created.state = { ...created.state, items: cached.items, nextCursor: cached.nextCursor, loading: false };
    return created;
  }, [fetchPage, cacheKey]);
  const [snapshot, setSnapshot] = useState({ feed, state: feed.state });
  useEffect(() => {
    const unsubscribe = feed.subscribe(state => {
      setSnapshot({ feed, state });
      if (cacheKey && !state.loading && !state.refreshing && !state.loadingMore && !state.error) feedCache.set(cacheKey, { items: state.items, nextCursor: state.nextCursor, at: Date.now() });
    });
    const cached = cacheKey ? feedCache.get(cacheKey) : undefined;
    if (!cached) void feed.refresh();
    else if (Date.now() - cached.at >= FRESH_MS) void feed.refreshLoaded();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let lastRefreshAt = cached?.at ?? Date.now();
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
  }, [feed, eventName, cacheKey]);
  return { ...(snapshot.feed === feed ? snapshot.state : feed.state), refresh: feed.refresh, loadMore: feed.loadMore, retry: feed.retry };
}
