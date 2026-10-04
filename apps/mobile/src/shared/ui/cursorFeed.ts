export type FeedPage<T> = { items: T[]; nextCursor: string | null };
export type FeedState<T> = FeedPage<T> & { loading: boolean; refreshing: boolean; loadingMore: boolean; error: string | null };

export class CursorFeed<T extends { id: string }> {
  state: FeedState<T> = { items: [], nextCursor: null, loading: true, refreshing: false, loadingMore: false, error: null };
  private generation = 0;
  private request: Promise<void> | null = null;
  private listener: ((state: FeedState<T>) => void) | null = null;
  private pendingRefresh = false;
  private lastWasMore = false;

  private fetchPage: (cursor?: string) => Promise<FeedPage<T>>;
  constructor(fetchPage: (cursor?: string) => Promise<FeedPage<T>>) { this.fetchPage = fetchPage; }

  subscribe(listener: (state: FeedState<T>) => void) {
    this.listener = listener;
    listener(this.state);
    return () => { this.listener = null; this.generation++; this.request = null; this.pendingRefresh = false; };
  }

  private update(patch: Partial<FeedState<T>>) {
    this.state = { ...this.state, ...patch };
    this.listener?.(this.state);
  }

  refresh = (): Promise<void> => {
    if (this.request) { this.pendingRefresh = true; return this.request; }
    return this.load(false);
  };
  loadMore = (): Promise<void> => this.load(true);
  retry = (): Promise<void> => this.load(this.lastWasMore);

  private load(more: boolean): Promise<void> {
    if (this.request) return this.request;
    const cursor = more ? this.state.nextCursor : undefined;
    if (more && !cursor) return Promise.resolve();
    this.lastWasMore = more;
    const generation = this.generation;
    this.update({ loading: this.state.items.length === 0, refreshing: !more && this.state.items.length > 0, loadingMore: more, error: null });
    const request = Promise.resolve().then(() => this.fetchPage(cursor ?? undefined)).then(page => {
      if (generation !== this.generation) return;
      const items = more ? [...this.state.items] : [];
      const byId = new Map(items.map((item, index) => [item.id, index]));
      for (const item of page.items) {
        const index = byId.get(item.id);
        if (index !== undefined) items[index] = item;
        else { byId.set(item.id, items.length); items.push(item); }
      }
      this.update({ items, nextCursor: page.nextCursor === cursor ? null : page.nextCursor });
    }).catch(() => {
      if (generation === this.generation) this.update({ error: 'Unable to load. Check your connection and try again.' });
    }).finally(() => {
      if (generation === this.generation) this.update({ loading: false, refreshing: false, loadingMore: false });
      if (this.request === request) this.request = null;
      if (generation === this.generation && this.pendingRefresh) {
        this.pendingRefresh = false;
        void this.refresh();
      }
    });
    this.request = request;
    return request;
  }
}
