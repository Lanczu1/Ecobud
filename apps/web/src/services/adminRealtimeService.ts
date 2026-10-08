import { API_HOST, clearAdminApiCache } from '../utils/adminApi';

export interface PresenceData {
  onlineUserIds: string[];
}

export interface AdminRealtimeHandlers {
  onContentRefresh?: () => void;
  onUsersRefresh?: () => void;
  onStatsRefresh?: () => void;
  onRedeemRefresh?: () => void;
  onPresenceChange?: (presence: PresenceData) => void;
}

const POLL_INTERVAL_MS = 30_000;
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
  private isNotifying = false;

  async connect(handlers: AdminRealtimeHandlers): Promise<() => void> {
    this.subscribers.add(handlers);
    if (this.subscribers.size === 1) this.start();

    return () => {
      this.subscribers.delete(handlers);
      if (this.subscribers.size === 0) this.stop();
    };
  }

  private start() {
    this.timer = setInterval(() => {
      if (document.visibilityState === 'visible') this.notifyAll();
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
    document.removeEventListener('visibilitychange', this.handleVisibility);
    window.removeEventListener('focus', this.handleFocus);
    window.removeEventListener('online', this.handleOnline);
  }

  private handleVisibility = () => {
    if (document.visibilityState === 'visible') this.notifyAll();
  };

  private handleFocus = () => this.notifyAll();
  private handleOnline = () => {
    this.notifyAll();
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
        headers: { Authorization: `Bearer ${token}`, Accept: 'text/event-stream' },
        cache: 'no-store',
        signal: controller.signal,
      });
      if (!response.ok || !response.body) throw new Error(`Stream unavailable: ${response.status}`);
      wasLive = true;
      this.reconnectDelay = RECONNECT_MIN_MS;
      // Changes made while the stream was down were missed, so catch up once on connect.
      this.queuePush();
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let tail = '';
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        const text = tail + decoder.decode(value, { stream: true });
        if (text.includes('data:')) this.queuePush();
        tail = text.slice(-4);
      }
    } catch {
      // Polling keeps the screens current until the stream comes back.
    } finally {
      if (this.stream === controller) {
        this.stream = null;
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

  private queuePush() {
    if (this.pushTimer) return;
    const wait = Math.max(PUSH_DELAY_MS, PUSH_MIN_GAP_MS - (Date.now() - this.lastNotifyAt));
    this.pushTimer = setTimeout(() => {
      this.pushTimer = null;
      // A hidden tab refreshes from handleVisibility when it is shown again.
      if (document.visibilityState === 'visible') this.notifyAll();
    }, wait);
  }

  notifyAll() {
    if (this.isNotifying) return;
    this.isNotifying = true;
    this.lastNotifyAt = Date.now();
    clearAdminApiCache();
    try {
      this.subscribers.forEach((sub) => {
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
