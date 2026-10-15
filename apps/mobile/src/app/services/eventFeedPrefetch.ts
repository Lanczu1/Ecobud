import { ecobudApi } from '../../shared/api/ecobudApi';
import { prefetchCursorFeed } from '../../shared/ui/useCursorFeed';

export type EventFeedScope = 'all' | 'browse' | 'joined' | 'past';

// Shared with the Eco Events screen so a prefetched page lands in the same cache slot it reads.
export const eventFeedKey = (token: string | undefined, scope: EventFeedScope, focusedId?: string | null) =>
  `eventsChanged:${token ?? 'guest'}:${scope}:${focusedId ?? ''}`;
export const eventHistoryKey = (token: string) => `eventsChanged:${token}:history`;

/** Starts the first page of every Eco Events tab at once; tabs already cached or loading are skipped. */
export function prefetchEventTabs(token: string | undefined) {
  for (const scope of ['browse', 'joined', 'past', 'all'] as const) {
    prefetchCursorFeed(eventFeedKey(token, scope), () => ecobudApi.fetchEvents(token, { limit: 20, scope }));
  }
  if (token) prefetchCursorFeed(eventHistoryKey(token), () => ecobudApi.fetchEventHistory(token));
}
