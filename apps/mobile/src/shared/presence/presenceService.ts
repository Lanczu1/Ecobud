import { ecobudApi, type PresenceSyncRequest } from '../api/ecobudApi';
import { mobileStorage } from '../storage/mobileStorage';
import type {
  PresenceAppState,
  PresenceConnectionState,
  PresenceSessionPayload,
} from '../types/presence';

export const MOBILE_PRESENCE_HEARTBEAT_INTERVAL_MS = 45_000;
export const MOBILE_PRESENCE_OFFLINE_GRACE_MS = 3_000;
export const MOBILE_PRESENCE_SYNC_DEBOUNCE_MS = 750;

interface PresenceSyncInput {
  token: string;
  userId: string;
  hasUsableInternet: boolean;
  sessionId?: string | null;
  appState: PresenceAppState;
  connectionState: PresenceConnectionState;
}

type PresenceSyncOperation = 'connect' | 'heartbeat' | 'disconnect';

interface PersistedPresenceIntent {
  operation: PresenceSyncOperation;
  sessionId: string | null;
  appState: PresenceAppState;
  connectionState: PresenceConnectionState;
  queuedAt: string;
}

interface PersistedPresenceState {
  pendingIntent: PersistedPresenceIntent | null;
  sessionId: string | null;
}

interface PresenceSyncOptions {
  clearSessionId?: boolean;
}

interface PresenceSyncResult {
  presence: PresenceSessionPayload | null;
  queued: boolean;
  sessionId: string | null;
  synced: boolean;
}

const PRESENCE_STORAGE_KEY_PREFIX = 'ecobud.mobile.presence';

const getPresenceStorageKey = (userId: string) =>
  `${PRESENCE_STORAGE_KEY_PREFIX}.${userId}`;

const toPresenceRequest = (input: PresenceSyncInput): PresenceSyncRequest => ({
  sessionId: input.sessionId ?? undefined,
  appState: input.appState,
  connectionState: input.connectionState,
});

const unwrapPresence = (
  response: { presence: PresenceSessionPayload | null },
) => response.presence ?? null;

const getDefaultPersistedState = (): PersistedPresenceState => ({
  pendingIntent: null,
  sessionId: null,
});

const readPersistedState = async (userId: string): Promise<PersistedPresenceState> => {
  const rawValue = await mobileStorage.getItem(getPresenceStorageKey(userId));

  if (!rawValue) {
    return getDefaultPersistedState();
  }

  try {
    const parsed = JSON.parse(rawValue) as Partial<PersistedPresenceState>;

    return {
      pendingIntent: parsed.pendingIntent ?? null,
      sessionId: parsed.sessionId ?? null,
    };
  } catch {
    return getDefaultPersistedState();
  }
};

const writePersistedState = async (
  userId: string,
  nextState: PersistedPresenceState,
) => {
  if (!nextState.sessionId && !nextState.pendingIntent) {
    await mobileStorage.removeItem(getPresenceStorageKey(userId));
    return;
  }

  await mobileStorage.setItem(
    getPresenceStorageKey(userId),
    JSON.stringify(nextState),
  );
};

const isRetryablePresenceError = (error: unknown) => {
  if (!(error instanceof Error)) {
    return false;
  }

  const normalizedMessage = error.message.toLowerCase();

  return (
    normalizedMessage.includes('unable to reach the ecobud api') ||
    normalizedMessage.includes('network') ||
    normalizedMessage.includes('fetch')
  );
};

const createPendingIntent = (
  operation: PresenceSyncOperation,
  input: PresenceSyncInput,
  persistedSessionId: string | null,
): PersistedPresenceIntent => ({
  operation,
  sessionId: input.sessionId ?? persistedSessionId ?? null,
  appState: input.appState,
  connectionState: input.connectionState,
  queuedAt: new Date().toISOString(),
});

const executePresenceOperation = async (
  operation: PresenceSyncOperation,
  input: PresenceSyncInput,
  persistedSessionId: string | null,
) => {
  const requestPayload = toPresenceRequest({
    ...input,
    sessionId: input.sessionId ?? persistedSessionId,
  });

  switch (operation) {
    case 'connect':
      return unwrapPresence(await ecobudApi.connectPresence(input.token, requestPayload));
    case 'heartbeat':
      if (!requestPayload.sessionId) {
        return unwrapPresence(await ecobudApi.connectPresence(input.token, requestPayload));
      }

      return unwrapPresence(await ecobudApi.heartbeatPresence(input.token, requestPayload));
    case 'disconnect':
      if (!requestPayload.sessionId) {
        return null;
      }

      return unwrapPresence(await ecobudApi.disconnectPresence(input.token, requestPayload));
  }
};

export const presenceService = {
  async restoreState(userId: string) {
    return readPersistedState(userId);
  },

  async clearState(userId: string) {
    await mobileStorage.removeItem(getPresenceStorageKey(userId));
  },

  async sync(
    operation: PresenceSyncOperation,
    input: PresenceSyncInput,
    options: PresenceSyncOptions = {},
  ): Promise<PresenceSyncResult> {
    const persistedState = await readPersistedState(input.userId);
    const nextIntent = createPendingIntent(
      operation,
      input,
      persistedState.sessionId,
    );

    if (!input.hasUsableInternet) {
      if (operation === 'disconnect' && options.clearSessionId) {
        await writePersistedState(input.userId, getDefaultPersistedState());

        return {
          presence: null,
          queued: false,
          sessionId: null,
          synced: false,
        };
      }

      await writePersistedState(input.userId, {
        pendingIntent: nextIntent,
        sessionId: nextIntent.sessionId,
      });

      return {
        presence: null,
        queued: true,
        sessionId: nextIntent.sessionId,
        synced: false,
      };
    }

    try {
      const presence = await executePresenceOperation(
        operation,
        input,
        persistedState.sessionId,
      );

      const nextSessionId =
        operation === 'disconnect' && options.clearSessionId
          ? null
          : presence?.sessionId ?? input.sessionId ?? persistedState.sessionId ?? null;

      await writePersistedState(input.userId, {
        pendingIntent: null,
        sessionId: nextSessionId,
      });

      return {
        presence,
        queued: false,
        sessionId: nextSessionId,
        synced: true,
      };
    } catch (error) {
      if (operation === 'disconnect' && options.clearSessionId) {
        await writePersistedState(input.userId, getDefaultPersistedState());

        return {
          presence: null,
          queued: false,
          sessionId: null,
          synced: false,
        };
      }

      if (isRetryablePresenceError(error)) {
        await writePersistedState(input.userId, {
          pendingIntent: nextIntent,
          sessionId: nextIntent.sessionId,
        });

        return {
          presence: null,
          queued: true,
          sessionId: nextIntent.sessionId,
          synced: false,
        };
      }

      throw error;
    }
  },
};
