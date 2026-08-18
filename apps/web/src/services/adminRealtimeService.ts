export interface PresenceData {
  onlineUserIds: string[];
}

export interface AdminRealtimeHandlers {
  onUsersRefresh?: () => void;
  onStatsRefresh?: () => void;
  onPresenceChange?: (presence: PresenceData) => void;
}

class AdminRealtimeService {
  private subscribers: Set<AdminRealtimeHandlers> = new Set();
  private timer: any = null;
  private isNotifying = false;

  async connect(handlers: AdminRealtimeHandlers): Promise<() => void> {
    this.subscribers.add(handlers);
    if (this.subscribers.size === 1) {
      this.start();
    }

    return () => {
      this.subscribers.delete(handlers);
      if (this.subscribers.size === 0) {
        this.stop();
      }
    };
  }

  private start() {
    // Periodic refresh every 5 seconds for fast real-time responsiveness
    this.timer = setInterval(() => {
      this.notifyAll();
    }, 5000);

    if (typeof window !== 'undefined') {
      window.addEventListener('visibilitychange', this.handleVisibility);
      window.addEventListener('focus', this.handleFocus);
      window.addEventListener('online', this.handleOnline);
    }
  }

  private stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    if (typeof window !== 'undefined') {
      window.removeEventListener('visibilitychange', this.handleVisibility);
      window.removeEventListener('focus', this.handleFocus);
      window.removeEventListener('online', this.handleOnline);
    }
  }

  private handleVisibility = () => {
    if (document.visibilityState === 'visible') {
      this.notifyAll();
    }
  };

  private handleFocus = () => {
    this.notifyAll();
  };

  private handleOnline = () => {
    this.notifyAll();
  };

  notifyAll() {
    if (this.isNotifying) return;
    this.isNotifying = true;
    try {
      this.subscribers.forEach((sub) => {
        try {
          sub.onUsersRefresh?.();
          sub.onStatsRefresh?.();
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
