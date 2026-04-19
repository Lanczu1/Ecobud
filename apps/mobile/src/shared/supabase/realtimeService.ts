import { type RealtimeChannel } from '@supabase/supabase-js';
import { type SessionPayload, ecobudApi } from '../api/ecobudApi';
import { isSupabaseRealtimeEnabled, supabaseClient } from './supabaseClient';

type RealtimeSignalChannel = 'learn' | 'challenges' | 'tracker';

interface RealtimeSignal {
  channel: RealtimeSignalChannel;
  reason: string;
  revision: number;
  updatedAt: string;
}

interface RealtimeNotice {
  level?: 'info' | 'success' | 'warning';
  message: string;
  revision: number;
  scope: 'moderation' | 'learn' | 'challenge' | 'tracker';
  title: string;
  updatedAt: string;
}

interface RealtimeConnectionHandlers {
  onNotice: (notice: RealtimeNotice) => void;
  onSignal: (signal: RealtimeSignal) => void;
  onConnectionChange?: (connected: boolean) => void;
}

const toRevision = (payload: unknown) => {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const candidate = (payload as { revision?: unknown }).revision;
  return typeof candidate === 'number' ? candidate : null;
};

const bindBroadcast = <TPayload extends RealtimeSignal | RealtimeNotice>(
  channelName: string,
  event: string,
  connectedAt: number,
  seenRevisions: Record<string, number>,
  onPayload: (payload: TPayload) => void,
) => {
  if (!supabaseClient) {
    return null;
  }

  const revisionKey = `${channelName}:${event}`;

  return supabaseClient
    .channel(channelName, {
      config: {
        broadcast: {
          ack: false,
          self: false,
        },
      },
    })
    .on('broadcast', { event }, ({ payload }) => {
      const revision = toRevision(payload);

      if (!payload || !revision) {
        return;
      }

      if (revision <= connectedAt || revision <= (seenRevisions[revisionKey] ?? 0)) {
        return;
      }

      seenRevisions[revisionKey] = revision;
      onPayload(payload as TPayload);
    })
    .subscribe();
};

const bindPresence = (
  channelName: string,
  session: SessionPayload,
) => {
  if (!supabaseClient) {
    return null;
  }

  const channel = supabaseClient
    .channel(channelName, {
      config: {
        presence: {
          enabled: true,
          key: session.user.id,
        },
      },
    })
    .subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await channel.track({
          timestamp: new Date().toISOString(),
          userId: session.user.id,
        });
      }
    });

  return channel;
};

export const realtimeService = {
  async connect(session: SessionPayload, handlers: RealtimeConnectionHandlers) {
    if (!isSupabaseRealtimeEnabled() || !supabaseClient) {
      handlers.onConnectionChange?.(false);
      return () => undefined;
    }

    try {
      const realtimeSession = await ecobudApi.fetchRealtimeSession(session.token);

      if (!realtimeSession.enabled || !realtimeSession.channels) {
        handlers.onConnectionChange?.(false);
        return () => undefined;
      }

      const connectedAt = Date.now();
      const seenRevisions: Record<string, number> = {};
      const presenceChannel = realtimeSession.channels.presenceMembers
        ? bindPresence(realtimeSession.channels.presenceMembers, session)
        : null;
      const channels: Array<RealtimeChannel | null> = [
        bindBroadcast<RealtimeSignal>(
          realtimeSession.channels.globalLearn,
          'refresh',
          connectedAt,
          seenRevisions,
          handlers.onSignal,
        ),
        bindBroadcast<RealtimeSignal>(
          realtimeSession.channels.globalChallenges,
          'refresh',
          connectedAt,
          seenRevisions,
          handlers.onSignal,
        ),
        bindBroadcast<RealtimeSignal>(
          realtimeSession.channels.userLearn,
          'refresh',
          connectedAt,
          seenRevisions,
          handlers.onSignal,
        ),
        bindBroadcast<RealtimeSignal>(
          realtimeSession.channels.userChallenges,
          'refresh',
          connectedAt,
          seenRevisions,
          handlers.onSignal,
        ),
        bindBroadcast<RealtimeSignal>(
          realtimeSession.channels.userTracker,
          'refresh',
          connectedAt,
          seenRevisions,
          handlers.onSignal,
        ),
        bindBroadcast<RealtimeNotice>(
          realtimeSession.channels.userNotice,
          'notice',
          connectedAt,
          seenRevisions,
          handlers.onNotice,
        ),
      ];

      if (presenceChannel) {
        channels.push(presenceChannel);
      }

      handlers.onConnectionChange?.(true);

      return () => {
        handlers.onConnectionChange?.(false);

        if (presenceChannel) {
          void presenceChannel.untrack().catch((error) => {
            console.warn('Supabase presence untrack failed during cleanup.', error);
          });
        }

        channels.forEach((channel) => {
          if (channel && supabaseClient) {
            void supabaseClient.removeChannel(channel);
          }
        });
      };
    } catch (error) {
      console.warn('Supabase realtime connection was skipped.', error);
      handlers.onConnectionChange?.(false);
      return () => undefined;
    }
  },
};
