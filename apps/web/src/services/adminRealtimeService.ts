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

/** Shared foreground refresh loop for admin screens that do not own a query cache. */
class AdminRealtimeService {
  private subscribers = new Set<AdminRealtimeHandlers>();
  private timer: ReturnType<typeof setInterval> | null = null;
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
    }, 30_000);
    window.addEventListener('visibilitychange', this.handleVisibility);
    window.addEventListener('focus', this.handleFocus);
    window.addEventListener('online', this.handleOnline);
  }

  private stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    window.removeEventListener('visibilitychange', this.handleVisibility);
    window.removeEventListener('focus', this.handleFocus);
    window.removeEventListener('online', this.handleOnline);
  }

  private handleVisibility = () => {
    if (document.visibilityState === 'visible') this.notifyAll();
  };

  private handleFocus = () => this.notifyAll();
  private handleOnline = () => this.notifyAll();

  notifyAll() {
    if (this.isNotifying) return;
    this.isNotifying = true;
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
