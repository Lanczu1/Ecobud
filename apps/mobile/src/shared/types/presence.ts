export type PresenceAppState = 'active' | 'background' | 'inactive';
export type PresenceConnectionState = 'online' | 'offline' | 'reconnecting' | 'stale';

export interface PresenceSessionPayload {
  sessionId: string;
  userId: string;
  isOnline: boolean;
  connectedAt: string;
  lastSeenAt: string;
  updatedAt: string;
  disconnectedAt: string | null;
  expiresAt: string;
  appState: PresenceAppState;
  connectionState: PresenceConnectionState;
}

export interface PresenceSyncResponse {
  presence: PresenceSessionPayload | null;
}

export interface PresenceNetworkStatus {
  hasUsableInternet: boolean;
  typeLabel: string;
}

export interface MobilePresenceState {
  appState: PresenceAppState;
  hasUsableInternet: boolean;
  isPresenceOnline: boolean;
  presenceSessionId: string | null;
  presenceSyncState: 'idle' | 'connecting' | 'connected' | 'offline' | 'error';
  lastPresenceSyncAt: string | null;
  lastPresenceError: string | null;
  shouldMaintainRealtimeConnection: boolean;
}
