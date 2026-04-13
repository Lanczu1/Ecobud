import { ecobudApi, type PresenceSyncRequest } from '../api/ecobudApi';
import type {
  PresenceAppState,
  PresenceConnectionState,
  PresenceSessionPayload,
} from '../types/presence';

export const MOBILE_PRESENCE_HEARTBEAT_INTERVAL_MS = 45_000;
export const MOBILE_PRESENCE_SYNC_DEBOUNCE_MS = 750;

interface PresenceSyncInput {
  token: string;
  sessionId?: string | null;
  appState: PresenceAppState;
  connectionState: PresenceConnectionState;
}

const toPresenceRequest = (input: PresenceSyncInput): PresenceSyncRequest => ({
  sessionId: input.sessionId ?? undefined,
  appState: input.appState,
  connectionState: input.connectionState,
});

const unwrapPresence = (
  response: { presence: PresenceSessionPayload | null },
) => response.presence ?? null;

export const presenceService = {
  async connect(input: PresenceSyncInput) {
    return unwrapPresence(
      await ecobudApi.connectPresence(input.token, toPresenceRequest(input)),
    );
  },

  async heartbeat(input: PresenceSyncInput) {
    return unwrapPresence(
      await ecobudApi.heartbeatPresence(input.token, toPresenceRequest(input)),
    );
  },

  async disconnect(input: PresenceSyncInput) {
    return unwrapPresence(
      await ecobudApi.disconnectPresence(input.token, toPresenceRequest(input)),
    );
  },
};
