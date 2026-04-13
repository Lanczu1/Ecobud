import { useNetInfo } from '@react-native-community/netinfo';
import React from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import type { SessionPayload } from '../api/ecobudApi';
import { type MobilePresenceState, type PresenceAppState } from '../types/presence';
import {
  MOBILE_PRESENCE_HEARTBEAT_INTERVAL_MS,
  MOBILE_PRESENCE_SYNC_DEBOUNCE_MS,
  presenceService,
} from './presenceService';

interface UsePresenceResult extends MobilePresenceState {
  disconnectPresence: (options?: {
    clearSessionId?: boolean;
    connectionState?: 'offline' | 'stale';
  }) => Promise<void>;
}

const normalizeAppState = (value: AppStateStatus): PresenceAppState => {
  if (value === 'active') {
    return 'active';
  }

  if (value === 'background') {
    return 'background';
  }

  return 'inactive';
};

const hasUsableInternetAccess = (
  isConnected: boolean | null,
  isInternetReachable: boolean | null,
) => Boolean(isConnected) && isInternetReachable !== false;

export function usePresence(
  session: SessionPayload | null,
  isReadOnlyExperience: boolean,
): UsePresenceResult {
  const netInfo = useNetInfo();
  const [appState, setAppState] = React.useState<PresenceAppState>(
    normalizeAppState(AppState.currentState),
  );
  const [presenceSessionId, setPresenceSessionId] = React.useState<string | null>(null);
  const [presenceSyncState, setPresenceSyncState] = React.useState<
    MobilePresenceState['presenceSyncState']
  >('idle');
  const [lastPresenceSyncAt, setLastPresenceSyncAt] = React.useState<string | null>(null);
  const [lastPresenceError, setLastPresenceError] = React.useState<string | null>(null);

  const hasUsableInternet = hasUsableInternetAccess(
    netInfo.isConnected,
    netInfo.isInternetReachable,
  );
  const shouldMaintainRealtimeConnection = Boolean(
    session && !isReadOnlyExperience && hasUsableInternet && appState === 'active',
  );

  const appStateRef = React.useRef(appState);
  const hasUsableInternetRef = React.useRef(hasUsableInternet);
  const presenceSessionIdRef = React.useRef<string | null>(presenceSessionId);
  const mountedRef = React.useRef(true);

  React.useEffect(() => {
    appStateRef.current = appState;
  }, [appState]);

  React.useEffect(() => {
    hasUsableInternetRef.current = hasUsableInternet;
  }, [hasUsableInternet]);

  React.useEffect(() => {
    presenceSessionIdRef.current = presenceSessionId;
  }, [presenceSessionId]);

  React.useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
    };
  }, []);

  React.useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      setAppState(normalizeAppState(nextState));
    });

    return () => {
      subscription.remove();
    };
  }, []);

  React.useEffect(() => {
    if (!session || isReadOnlyExperience) {
      setPresenceSyncState('idle');
      setLastPresenceError(null);
      setLastPresenceSyncAt(null);
      setPresenceSessionId(null);
    }
  }, [isReadOnlyExperience, session]);

  const connectPresence = React.useCallback(async () => {
    if (!session || isReadOnlyExperience || !hasUsableInternetRef.current) {
      return;
    }

    setPresenceSyncState((currentState) =>
      currentState === 'connected' ? currentState : 'connecting',
    );

    try {
      const presence = await presenceService.connect({
        token: session.token,
        sessionId: presenceSessionIdRef.current,
        appState: appStateRef.current,
        connectionState: presenceSessionIdRef.current ? 'reconnecting' : 'online',
      });

      if (!mountedRef.current) {
        return;
      }

      if (presence?.sessionId) {
        setPresenceSessionId(presence.sessionId);
      }

      setPresenceSyncState('connected');
      setLastPresenceSyncAt(presence?.lastSeenAt ?? new Date().toISOString());
      setLastPresenceError(null);
    } catch (error) {
      if (!mountedRef.current) {
        return;
      }

      setPresenceSyncState(hasUsableInternetRef.current ? 'error' : 'offline');
      setLastPresenceError(
        error instanceof Error ? error.message : 'Unable to sync presence right now.',
      );
    }
  }, [isReadOnlyExperience, session]);

  const heartbeatPresence = React.useCallback(async () => {
    if (
      !session ||
      isReadOnlyExperience ||
      !hasUsableInternetRef.current ||
      !presenceSessionIdRef.current
    ) {
      return;
    }

    try {
      const presence = await presenceService.heartbeat({
        token: session.token,
        sessionId: presenceSessionIdRef.current,
        appState: appStateRef.current,
        connectionState: 'online',
      });

      if (!mountedRef.current) {
        return;
      }

      if (presence?.sessionId && presence.sessionId !== presenceSessionIdRef.current) {
        setPresenceSessionId(presence.sessionId);
      }

      setPresenceSyncState('connected');
      setLastPresenceSyncAt(presence?.lastSeenAt ?? new Date().toISOString());
      setLastPresenceError(null);
    } catch (error) {
      if (!mountedRef.current) {
        return;
      }

      setPresenceSyncState(hasUsableInternetRef.current ? 'error' : 'offline');
      setLastPresenceError(
        error instanceof Error ? error.message : 'Presence heartbeat failed.',
      );
    }
  }, [isReadOnlyExperience, session]);

  const disconnectPresence = React.useCallback<
    UsePresenceResult['disconnectPresence']
  >(
    async (options) => {
      const activeSessionId = presenceSessionIdRef.current;
      const clearSessionId = options?.clearSessionId ?? false;
      const connectionState = options?.connectionState ?? 'offline';

      setPresenceSyncState('offline');

      if (!session || isReadOnlyExperience || !activeSessionId) {
        if (clearSessionId) {
          setPresenceSessionId(null);
        }
        return;
      }

      if (!hasUsableInternetRef.current) {
        if (clearSessionId) {
          setPresenceSessionId(null);
        }
        return;
      }

      try {
        const presence = await presenceService.disconnect({
          token: session.token,
          sessionId: activeSessionId,
          appState: appStateRef.current,
          connectionState,
        });

        if (!mountedRef.current) {
          return;
        }

        setLastPresenceSyncAt(
          presence?.lastSeenAt ?? lastPresenceSyncAt ?? new Date().toISOString(),
        );
        setLastPresenceError(null);
      } catch (error) {
        if (!mountedRef.current) {
          return;
        }

        setLastPresenceError(
          error instanceof Error ? error.message : 'Unable to close presence cleanly.',
        );
      } finally {
        if (clearSessionId) {
          setPresenceSessionId(null);
        }
      }
    },
    [isReadOnlyExperience, lastPresenceSyncAt, session],
  );

  React.useEffect(() => {
    if (!session || isReadOnlyExperience) {
      return;
    }

    const timeoutId = setTimeout(() => {
      if (shouldMaintainRealtimeConnection) {
        void connectPresence();
        return;
      }

      void disconnectPresence();
    }, MOBILE_PRESENCE_SYNC_DEBOUNCE_MS);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [
    connectPresence,
    disconnectPresence,
    isReadOnlyExperience,
    session,
    shouldMaintainRealtimeConnection,
  ]);

  React.useEffect(() => {
    if (!shouldMaintainRealtimeConnection || !presenceSessionId) {
      return;
    }

    const heartbeatTimer = setInterval(() => {
      void heartbeatPresence();
    }, MOBILE_PRESENCE_HEARTBEAT_INTERVAL_MS);

    return () => {
      clearInterval(heartbeatTimer);
    };
  }, [heartbeatPresence, presenceSessionId, shouldMaintainRealtimeConnection]);

  React.useEffect(() => {
    if (!session || isReadOnlyExperience) {
      return;
    }

    if (!hasUsableInternet) {
      setPresenceSyncState('offline');
    }
  }, [hasUsableInternet, isReadOnlyExperience, session]);

  return {
    appState,
    hasUsableInternet,
    isPresenceOnline: shouldMaintainRealtimeConnection && presenceSyncState === 'connected',
    presenceSessionId,
    presenceSyncState,
    lastPresenceSyncAt,
    lastPresenceError,
    shouldMaintainRealtimeConnection,
    disconnectPresence,
  };
}
