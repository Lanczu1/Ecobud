import { ADMIN_CLIENT_ID, API_HOST, markForeignChangePush, markOwnChangePush } from '../utils/adminApi';

export interface PresenceData {
  onlineUserIds: string[];
}

/** The admin screens a change can touch; the server names them on every push. */
export type AdminChangeSection =
  | 'challenges' | 'events' | 'lessons' | 'badges' | 'users' | 'presence' | 'announcements'
  | 'giveget' | 'redeem' | 'idVerification' | 'notifications' | 'dashboard';

export interface AdminRealtimeHandlers {
  /** The changes this screen shows. Left out, it refreshes on every change. */
  sections?: AdminChangeSection[];
  onContentRefresh?: () => void;
  onUsersRefresh?: () => void;
  onStatsRefresh?: () => void;
  onRedeemRefresh?: () => void;
  onPresenceChange?: (presence: PresenceData) => void;
}

/** Every section except presence: for screens that need any real change but not residents coming and going. */
export const ALL_BUT_PRESENCE: AdminChangeSection[] = [
  'challenges', 'events', 'lessons', 'badges', 'users', 'announcements', 'giveget', 'redeem', 'idVerification', 'notifications', 'dashboard',
];

type PendingChange = { sections: Set<AdminChangeSection> | 'all'; own: boolean };

const POLL_INTERVAL_MS = 30_000;
// While the stream is delivering, the poll only covers changes the stream cannot see.
const LIVE_POLL_INTERVAL_MS = 120_000;
// The server pings every 25s, so a longer silence means the stream is stalled or buffered.
const STREAM_STALE_MS = 60_000;
const PUSH_DELAY_MS = 300;
const PUSH_MIN_GAP_MS = 3_000;
const RECONNECT_MIN_MS = 2_000;
const RECONNECT_MAX_MS = 30_000;

/** Shared refresh loop for admin screens: server push first, with a foreground poll as the fallback. */
class AdminRealtimeService {
  private subscribers = new Set<AdminRealtimeHandlers>();
  private timer: ReturnType<typeof setInterval> | null = null;
  private pushTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private stream: AbortController | null = null;
  private reconnectDelay = RECONNECT_MIN_MS;
  private lastNotifyAt = 0;
  private lastStreamDataAt = 0;
  private hasStreamed = false;
  private isNotifying = false;
  private pending: PendingChange | null = null;

  async connect(handlers: AdminRealtimeHandlers): Promise<() => void> {
    this.subscribers.add(handlers);
    if (this.subscribers.size === 1) this.start();

    return () => {
      this.subscribers.delete(handlers);
      if (this.subscribers.size === 0) this.stop();
    };
  }

  /** True while server pushes are arriving, so screens can skip their own timers. */
  isLive() {
    return this.stream !== null && Date.now() - this.lastStreamDataAt < STREAM_STALE_MS;
  }

  private start() {
    this.timer = setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      if (this.isLive() && Date.now() - this.lastNotifyAt < LIVE_POLL_INTERVAL_MS) return;
      this.queuePush('all', false);
    }, POLL_INTERVAL_MS);
    document.addEventListener('visibilitychange', this.handleVisibility);
    window.addEventListener('focus', this.handleFocus);
    window.addEventListener('online', this.handleOnline);
    void this.openStream();
  }

  private stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    if (this.pushTimer) clearTimeout(this.pushTimer);
    this.pushTimer = null;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
    this.stream?.abort();
    this.stream = null;
    this.pending = null;
    document.removeEventListener('visibilitychange', this.handleVisibility);
    window.removeEventListener('focus', this.handleFocus);
    window.removeEventListener('online', this.handleOnline);
  }

  // Pushes that arrived while the tab was hidden are held, then delivered when it is shown again.
  // Without a working stream nothing was heard, so the screens catch up in full.
  private handleVisibility = () => {
    if (document.visibilityState !== 'visible') return;
    if (!this.isLive()) this.queuePush('all', false);
    else if (this.pending) this.schedule();
  };

  // A live stream already delivered every change; focus only matters when it is down.
  private handleFocus = () => {
    if (!this.isLive()) this.queuePush('all', false);
  };

  private handleOnline = () => {
    this.queuePush('all', false);
    if (!this.stream) {
      if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
      void this.openStream();
    }
  };

  private async openStream() {
    if (this.stream || this.subscribers.size === 0) return;
    const token = localStorage.getItem('ecobud_admin_token');
    const controller = new AbortController();
    this.stream = controller;
    let wasLive = false;
    try {
      if (!token) throw new Error('Not signed in.');
      const response = await fetch(`${API_HOST}/api/realtime/admin-stream`, {
        headers: { Authorization: `Bearer ${token}`, Accept: 'text/event-stream', 'X-Admin-Client': ADMIN_CLIENT_ID },
        cache: 'no-store',
        signal: controller.signal,
      });
      if (!response.ok || !response.body) throw new Error(`Stream unavailable: ${response.status}`);
      wasLive = true;
      this.lastStreamDataAt = Date.now();
      this.reconnectDelay = RECONNECT_MIN_MS;
      // Changes made while a previous stream was down were missed, so catch up once on reconnect.
      // The first connection needs no catch-up: the screens have just loaded.
      if (this.hasStreamed) this.queuePush('all', false);
      this.hasStreamed = true;
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        this.lastStreamDataAt = Date.now();
        buffer += decoder.decode(value, { stream: true });
        const messages = buffer.split('\n\n');
        buffer = messages.pop() ?? '';
        for (const message of messages) this.readMessage(message);
      }
    } catch {
      // Polling keeps the screens current until the stream comes back.
    } finally {
      if (this.stream === controller) {
        this.stream = null;
        this.lastStreamDataAt = 0;
        if (this.subscribers.size > 0) {
          const delay = wasLive ? RECONNECT_MIN_MS : this.reconnectDelay;
          if (!wasLive) this.reconnectDelay = Math.min(RECONNECT_MAX_MS, this.reconnectDelay * 2);
          this.reconnectTimer = setTimeout(() => {
            this.reconnectTimer = null;
            void this.openStream();
          }, delay);
        }
      }
    }
  }

  // One server-sent message: data is {"sections": [...] | "all", "own": boolean}. Anything else
  // (an older server's "change") is treated as an unknown change to every screen.
  private readMessage(message: string) {
    const data = message.split('\n').filter(line => line.startsWith('data:')).map(line => line.slice(5).trim()).join('\n');
    if (!data) return;
    try {
      const change = JSON.parse(data) as { sections?: unknown; own?: unknown };
      const sections = Array.isArray(change.sections) ? change.sections as AdminChangeSection[] : 'all';
      this.queuePush(sections, change.own === true);
    } catch {
      this.queuePush('all', false);
    }
  }

  private queuePush(sections: AdminChangeSection[] | 'all', own: boolean) {
    const pending = this.pending ?? { sections: new Set<AdminChangeSection>(), own: true };
    if (sections === 'all' || pending.sections === 'all') pending.sections = 'all';
    else for (const section of sections) pending.sections.add(section);
    pending.own = pending.own && own;
    this.pending = pending;
    this.schedule();
  }

  private schedule() {
    if (this.pushTimer) return;
    const wait = Math.max(PUSH_DELAY_MS, PUSH_MIN_GAP_MS - (Date.now() - this.lastNotifyAt));
    this.pushTimer = setTimeout(() => {
      this.pushTimer = null;
      // A hidden tab keeps the change and delivers it from handleVisibility when it is shown again.
      if (document.visibilityState !== 'visible' || !this.pending) return;
      const change = this.pending;
      this.pending = null;
      this.notify(change);
    }, wait);
  }

  /** Refreshes every screen now, as for a change to all of them made by someone else. */
  notifyAll() {
    this.notify({ sections: 'all', own: false });
  }

  private notify(change: PendingChange) {
    if (this.isNotifying) return;
    this.isNotifying = true;
    this.lastNotifyAt = Date.now();
    if (change.own) markOwnChangePush();
    else markForeignChangePush();
    try {
      this.subscribers.forEach((sub) => {
        const wanted = change.sections === 'all' || !sub.sections || sub.sections.some(section => (change.sections as Set<AdminChangeSection>).has(section));
        if (!wanted) return;
        try {
          sub.onUsersRefresh?.();
          sub.onStatsRefresh?.();
          sub.onRedeemRefresh?.();
          sub.onContentRefresh?.();
        } catch (err) {
          console.error('AdminRealtimeService subscriber notification error:', err);
        }
      });
    } finally {
      this.isNotifying = false;
    }
  }
}

export const adminRealtimeService = new AdminRealtimeService();
