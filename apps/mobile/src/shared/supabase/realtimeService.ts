import { type SessionPayload } from '../api/ecobudApi';
import { subscribeAuthenticatedRealtime } from './authenticatedRealtime';
import { setRealtimeHealthy } from './realtimeHealth';

type RealtimeSignalChannel = 'learn' | 'challenges' | 'tracker';

interface RealtimeSignal {
  channel: RealtimeSignalChannel | 'events';
  reason: string;
  revision: number;
  updatedAt: string;
}

interface RealtimeNotice {
  relatedType?: string;
  level?: 'info' | 'success' | 'warning';
  message: string;
  revision: number;
  scope: 'notifications' | 'moderation' | 'learn' | 'challenge' | 'tracker';
  title: string;
  updatedAt: string;
}

interface RealtimeConnectionHandlers {
  onNotice?: (notice: RealtimeNotice) => void;
  onSignal?: (signal: RealtimeSignal) => void;
  onConnectionChange?: (connected: boolean) => void;
  onSessionExpired?: () => void;
}

export const realtimeService = {
  async connect(session: SessionPayload, handlers: RealtimeConnectionHandlers) {
    return subscribeAuthenticatedRealtime(session.token, {
      onStatus: live => { setRealtimeHealthy(live); handlers.onConnectionChange?.(live); },
      onExpired: handlers.onSessionExpired,
      onMessage: message => {
        if (message.event === 'refresh') handlers.onSignal?.(message.payload as unknown as RealtimeSignal);
        if (message.event === 'notice') handlers.onNotice?.(message.payload as unknown as RealtimeNotice);
      },
    });
  },
};
