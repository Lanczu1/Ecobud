export interface PresenceData {
  onlineUserIds: string[];
}

export interface AdminRealtimeHandlers {
  onUsersRefresh: () => void;
  onPresenceChange?: (presence: PresenceData) => void;
}

class AdminRealtimeService {
  async connect(handlers: AdminRealtimeHandlers): Promise<() => void> {
    // Periodic refresh of user data every 30 seconds
    const interval = setInterval(() => {
      handlers.onUsersRefresh();
    }, 30000);

    return () => {
      clearInterval(interval);
    };
  }
}

export const adminRealtimeService = new AdminRealtimeService();

