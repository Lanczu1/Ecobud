# Mobile polling and pagination rollout

Apply `20261004000000_mobile_cursor_paging` with the existing production migration workflow (`npm run db:migrate:deploy` from `apps/api`). Deploy the API before releasing the updated mobile app. This migration adds indexes only; it does not change stored data. It has not been applied to the configured database during implementation.

- Home uses a 60-second foreground fallback. Realtime signals refresh affected resources after a 450ms debounce; bootstrap, foreground session recovery, and pull-to-refresh still hydrate the Home data. Unchanged responses retain their current React state references.
- `GET /swap/conversations/:id/messages?paged=1&limit=40` returns `{ items, nextCursor, newestCursor }`. Items are chronological. `before=nextCursor` loads older messages; `after=newestCursor` catches up on new messages in ascending pages. Do not send both directions. The legacy response remains an array, capped at 40 by default.
- `GET /events?limit=20&scope=browse` returns `{ items, nextCursor }`. Send `cursor=nextCursor` for another page. Scopes are `all`, `home`, `browse`, `joined`, and `past`. `id` retrieves a deep-linked event subject to the same publication and barangay restrictions. Rejected attendance remains accessible in My Events.
- `GET /users/me/history?limit=20` returns the authenticated user's Coins & Points history as `{ items, nextCursor }`. `GET /users/me` keeps its five recent logs and returns at most 20 event-history previews, with `eventHistoryHasMore`; the paginated event directory provides older registered events.

All page sizes are capped at 50. Cursors include a timestamp and ID to distinguish records with equal timestamps; event cursors also include featured status. Message fetches, sends, and read updates require an existing authorized conversation.

Check chat on Android and iOS before release: open a long conversation, scroll upward to load older pages, receive and send messages while browsing history, background and resume, and retry with an interrupted connection. Check event filters and deep links, map paging, and history refresh. Automated tests cover cursor boundaries, ownership, request deduplication, retries, and stale responses; device frame-rate and concurrent-user capacity have not been measured by this change.
