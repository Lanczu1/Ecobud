import { useNetInfo } from '@react-native-community/netinfo';
import React from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import type { SessionPayload } from '../api/ecobudApi';
import { type MobilePresenceState, type PresenceAppState } from '../types/presence';
import {
  MOBILE_PRESENCE_HEARTBEAT_INTERVAL_MS,
  MOBILE_PRESENCE_OFFLINE_GRACE_MS,
  MOBILE_PRESENCE_SYNC_DEBOUNCE_MS,
  presenceService,
} from './presenceService';

interface UsePresenceResult extends MobilePresenceState {
  disconnectPresence: (options?: {
    clearSessionId?: boolean;
    connectionState?: 'offline' | 'stale';
    requireImmediateSync?: boolean;
  }) => Promise<{
    queued: boolean;
    synced: boolean;
  }>;
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
  const rawHasUsableInternet = hasUsableInternetAccess(
    netInfo.isConnected,
    netInfo.isInternetReachable,
  );
  const userId = session?.user.id ?? null;
  const [appState, setAppState] = React.useState<PresenceAppState>(
    normalizeAppState(AppState.currentState),
  );
  const [presenceSessionId, setPresenceSessionId] = React.useState<string | null>(null);
  const [presenceReady, setPresenceReady] = React.useState(false);
  const [hasUsableInternet, setHasUsableInternet] = React.useState(
    rawHasUsableInternet || netInfo.isConnected == null,
  );
  const [presenceSyncState, setPresenceSyncState] = React.useState<
    MobilePresenceState['presenceSyncState']
  >('idle');
  const [lastPresenceSyncAt, setLastPresenceSyncAt] = React.useState<string | null>(null);
  const [lastPresenceError, setLastPresenceError] = React.useState<string | null>(null);

  const shouldMaintainRealtimeConnection = Boolean(
    session && !isReadOnlyExperience && hasUsableInternet && appState === 'active',
  );

  const appStateRef = React.useRef(appState);
  const hasUsableInternetRef = React.useRef(hasUsableInternet);
  const offlineModeTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const presenceSessionIdRef = React.useRef<string | null>(presenceSessionId);
  const mountedRef = React.useRef(true);

  React.useEffect(() => {
    appStateRef.current = appState;
  }, [appState]);

  React.useEffect(() => {
    hasUsableInternetRef.current = hasUsableInternet;
  }, [hasUsableInternet]);

  React.useEffect(() => {
    if (rawHasUsableInternet) {
      if (offlineModeTimerRef.current) {
        clearTimeout(offlineModeTimerRef.current);
        offlineModeTimerRef.current = null;
      }

      setHasUsableInternet(true);
      return;
    }

    if (!hasUsableInternet || offlineModeTimerRef.current) {
      return;
    }

    // Only mark the mobile app as fully offline after a sustained loss.
    offlineModeTimerRef.current = setTimeout(() => {
      offlineModeTimerRef.current = null;

      if (mountedRef.current) {
        setHasUsableInternet(false);
      }
    }, MOBILE_PRESENCE_OFFLINE_GRACE_MS);
  }, [hasUsableInternet, rawHasUsableInternet]);

  React.useEffect(() => {
    presenceSessionIdRef.current = presenceSessionId;
  }, [presenceSessionId]);

  React.useEffect(() => {
    mountedRef.current = true;

    return () => {
      if (offlineModeTimerRef.current) {
        clearTimeout(offlineModeTimerRef.current);
        offlineModeTimerRef.current = null;
      }

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
    let isActive = true;

    if (!session || isReadOnlyExperience || !userId) {
      setPresenceSyncState('idle');
      setLastPresenceError(null);
      setLastPresenceSyncAt(null);
      setPresenceSessionId(null);
      setPresenceReady(true);
      return;
    }

    setPresenceReady(false);

    void presenceService
      .restoreState(userId)
      .then((persistedState) => {
        if (!isActive) {
          return;
        }

        setPresenceSessionId(persistedState.sessionId);
        setLastPresenceSyncAt(persistedState.pendingIntent?.queuedAt ?? null);
        setPresenceReady(true);
      })
      .catch((error) => {
        if (!isActive) {
          return;
        }

        setLastPresenceError(
          error instanceof Error ? error.message : 'Unable to restore presence state.',
        );
        setPresenceReady(true);
      });

    return () => {
      isActive = false;
    };
  }, [isReadOnlyExperience, session, userId]);

  const connectPresence = React.useCallback(async () => {
    if (!session || isReadOnlyExperience || !userId) {
      return;
    }

    setPresenceSyncState((currentState) =>
      currentState === 'connected' ? currentState : 'connecting',
    );

    try {
      const result = await presenceService.sync(
        'connect',
        {
        token: session.token,
        userId,
        hasUsableInternet: hasUsableInternetRef.current,
        sessionId: presenceSessionIdRef.current,
        appState: appStateRef.current,
        connectionState: presenceSessionIdRef.current ? 'reconnecting' : 'online',
        },
      );

      if (!mountedRef.current) {
        return;
      }

      if (result.sessionId !== undefined) {
        setPresenceSessionId(result.sessionId);
      }

      if (result.queued) {
        setPresenceSyncState('offline');
        setLastPresenceSyncAt(new Date().toISOString());
        setLastPresenceError('Waiting for internet to synchronize live status.');
        return;
      }

      setPresenceSyncState('connected');
      setLastPresenceSyncAt(result.presence?.lastSeenAt ?? new Date().toISOString());
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
  }, [isReadOnlyExperience, session, userId]);

  const heartbeatPresence = React.useCallback(async () => {
    if (
      !session ||
      isReadOnlyExperience ||
      !userId ||
      !presenceSessionIdRef.current
    ) {
      return;
    }

    try {
      const result = await presenceService.sync(
        'heartbeat',
        {
        token: session.token,
        userId,
        hasUsableInternet: hasUsableInternetRef.current,
        sessionId: presenceSessionIdRef.current,
        appState: appStateRef.current,
        connectionState: 'online',
        },
      );

      if (!mountedRef.current) {
        return;
      }

      if (result.sessionId !== undefined && result.sessionId !== presenceSessionIdRef.current) {
        setPresenceSessionId(result.sessionId);
      }

      if (result.queued) {
        setPresenceSyncState('offline');
        setLastPresenceSyncAt(new Date().toISOString());
        setLastPresenceError('Offline mode active. Presence will resync automatically.');
        return;
      }

      setPresenceSyncState('connected');
      setLastPresenceSyncAt(result.presence?.lastSeenAt ?? new Date().toISOString());
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
  }, [isReadOnlyExperience, session, userId]);

  const disconnectPresence = React.useCallback<
    UsePresenceResult['disconnectPresence']
  >(
    async (options) => {
      const activeSessionId = presenceSessionIdRef.current;
      const clearSessionId = options?.clearSessionId ?? false;
      const connectionState = options?.connectionState ?? 'offline';
      const requireImmediateSync = options?.requireImmediateSync ?? false;

      setPresenceSyncState('offline');

      if (!session || isReadOnlyExperience || !userId || !activeSessionId) {
        if (clearSessionId) {
          setPresenceSessionId(null);
        }
        return { queued: false, synced: false };
      }

      try {
        const result = await presenceService.sync(
          'disconnect',
          {
          token: session.token,
          userId,
          hasUsableInternet: hasUsableInternetRef.current,
          sessionId: activeSessionId,
          appState: appStateRef.current,
          connectionState,
          },
          { clearSessionId },
        );

        if (!mountedRef.current) {
          return { queued: result.queued, synced: result.synced };
        }

        setPresenceSessionId(result.sessionId);
        setLastPresenceSyncAt(
          result.presence?.lastSeenAt ?? lastPresenceSyncAt ?? new Date().toISOString(),
        );

        if (result.queued) {
          if (requireImmediateSync && hasUsableInternetRef.current) {
            throw new Error('Unable to confirm server sign-out presence update.');
          }

          setLastPresenceError('Offline mode active. Presence will sync when internet returns.');
          return { queued: true, synced: false };
        }

        setLastPresenceError(null);
        return { queued: false, synced: true };
      } catch (error) {
        if (!mountedRef.current) {
          return { queued: false, synced: false };
        }

        setLastPresenceError(
          error instanceof Error ? error.message : 'Unable to close presence cleanly.',
        );
        throw error;
      } finally {
        if (clearSessionId) {
          setPresenceSessionId(null);
        }
      }
    },
    [isReadOnlyExperience, lastPresenceSyncAt, session, userId],
  );

  React.useEffect(() => {
    if (!presenceReady || !session || isReadOnlyExperience) {
      return;
    }

    const presenceTransitionDelayMs = hasUsableInternet
      ? MOBILE_PRESENCE_SYNC_DEBOUNCE_MS
      : 0;

    const timeoutId = setTimeout(() => {
      if (shouldMaintainRealtimeConnection) {
        void connectPresence();
        return;
      }

      void disconnectPresence();
    }, presenceTransitionDelayMs);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [
    connectPresence,
    disconnectPresence,
    hasUsableInternet,
    isReadOnlyExperience,
    presenceReady,
    session,
    shouldMaintainRealtimeConnection,
  ]);

  React.useEffect(() => {
    if (!presenceReady || !shouldMaintainRealtimeConnection || !presenceSessionId) {
      return;
    }

    const heartbeatTimer = setInterval(() => {
      void heartbeatPresence();
    }, MOBILE_PRESENCE_HEARTBEAT_INTERVAL_MS);

    return () => {
      clearInterval(heartbeatTimer);
    };
  }, [heartbeatPresence, presenceReady, presenceSessionId, shouldMaintainRealtimeConnection]);

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
