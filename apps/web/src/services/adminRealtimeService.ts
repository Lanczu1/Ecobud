export interface PresenceData {
  onlineUserIds: string[];
}

export interface AdminRealtimeHandlers {
  onUsersRefresh: () => void;
  onPresenceChange: (presence: PresenceData) => void;
}

class AdminRealtimeService {
  async connect(handlers: AdminRealtimeHandlers): Promise<() => void> {
    // Mock implementation for now
    const interval = setInterval(() => {
      // Simulate periodic updates or keep-alive
      handlers.onPresenceChange({ onlineUserIds: [] });
    }, 10000);

    return () => {
      clearInterval(interval);
    };
  }
}

export const adminRealtimeService = new AdminRealtimeService();
