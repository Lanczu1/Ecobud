import { AsyncLocalStorage } from 'async_hooks';
import { EventEmitter } from 'events';

/** The admin screens a change can affect. 'presence' is residents coming online or going offline. */
export type AdminLiveSection =
  | 'challenges' | 'events' | 'lessons' | 'badges' | 'users' | 'presence' | 'announcements'
  | 'giveget' | 'redeem' | 'idVerification' | 'notifications' | 'dashboard';

/** origin is the admin browser that made the change, or null for residents, jobs and unknown callers. */
export type AdminLiveChange = { sections: AdminLiveSection[] | 'all'; origin: string | null };

const bus = new EventEmitter();
bus.setMaxListeners(0);

// The admin browser behind the request being handled, so service-level emits can say whose change it was.
// It holds only until the answer is sent: that browser reloads after the answer, so work that finishes
// later (background follow-ups) must reach it as someone else's change, which it always reads afresh.
const requestOrigin = new AsyncLocalStorage<{ origin: string | null }>();

/** In-process change feed for the admin web stream: which screens changed and who changed them, no data. */
export const adminLiveEvents = {
  emit(sections: AdminLiveSection[] | 'all' = 'all', origin: string | null = requestOrigin.getStore()?.origin ?? null) {
    if (sections !== 'all' && sections.length === 0) return;
    bus.emit('change', { sections, origin } satisfies AdminLiveChange);
  },
  subscribe(listener: (change: AdminLiveChange) => void) {
    bus.on('change', listener);
    return () => { bus.off('change', listener); };
  },
  /** Runs the rest of a request on behalf of an admin browser; release() ends that once its answer is sent. */
  withOrigin(origin: string | null, run: (release: () => void) => void) {
    const store = { origin };
    requestOrigin.run(store, () => run(() => { store.origin = null; }));
  },
};

/** The id an admin browser sends in X-Admin-Client, or null when absent or malformed. */
export function adminClientId(value: unknown): string | null {
  return typeof value === 'string' && /^[A-Za-z0-9-]{8,64}$/.test(value) ? value : null;
}

// Path prefixes under /api, longest first where they overlap. Anything unlisted refreshes every screen.
const SECTION_ROUTES: [prefix: string, sections: AdminLiveSection[]][] = [
  ['/admin/upload', []],
  ['/admin/transcribe', []],
  ['/admin/challenges', ['challenges']],
  ['/admin/submissions', ['challenges', 'events']],
  ['/admin/events', ['events']],
  ['/admin/lessons', ['lessons']],
  ['/admin/badges', ['badges']],
  ['/admin/users', ['users']],
  ['/admin/notifications', ['notifications']],
  ['/admin/announcements', ['announcements']],
  ['/moderation/events', ['events']],
  ['/challenges', ['challenges']],
  ['/events', ['events']],
  ['/learn', ['lessons']],
  ['/lessons', ['lessons']],
  ['/announcements', ['announcements']],
  ['/give-and-get', ['giveget']],
  ['/swap', ['giveget']],
  ['/redeem', ['redeem']],
  ['/id-verification', ['idVerification', 'users']],
  ['/notifications', ['notifications']],
  ['/auth', ['users']],
  ['/users', ['users']],
  ['/user', ['users']],
  ['/home', ['users']],
  ['/habits', ['users']],
];

/** Which admin screens a successful write to this /api path can change. */
export function sectionsForPath(path: string): AdminLiveSection[] | 'all' {
  for (const [prefix, sections] of SECTION_ROUTES) {
    if (path === prefix || path.startsWith(`${prefix}/`)) return sections;
  }
  return 'all';
}
