import { type RealtimeChannel } from '@supabase/supabase-js';
import type { AdminRealtimeSessionPayload } from '../types/admin';
import { adminService } from './adminService';
import { adminSupabaseClient, isAdminSupabaseRealtimeEnabled } from './adminSupabaseClient';

type AdminRealtimeSignalChannel = 'dashboard' | 'users';

interface AdminRealtimeSignal {
  channel: AdminRealtimeSignalChannel;
  reason: string;
  revision: number;
  updatedAt: string;
}

interface AdminRealtimeHandlers {
  onDashboardRefresh?: (signal: AdminRealtimeSignal) => void;
  onPresenceChange?: (presence: { count: number; onlineUserIds: string[] }) => void;
  onUsersRefresh?: (signal: AdminRealtimeSignal) => void;
}

interface PresenceMeta {
  userId?: string | null;
}

const toRevision = (payload: unknown) => {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const candidate = (payload as { revision?: unknown }).revision;
  return typeof candidate === 'number' ? candidate : null;
};

const bindAdminBroadcast = (
  channelName: string,
  connectedAt: number,
  seenRevisions: Record<string, number>,
  onSignal: (signal: AdminRealtimeSignal) => void,
) => {
  if (!adminSupabaseClient) {
    return null;
  }

  const revisionKey = `${channelName}:refresh`;

  return adminSupabaseClient
    .channel(channelName, {
      config: {
        broadcast: {
          ack: false,
          self: false,
        },
      },
    })
    .on('broadcast', { event: 'refresh' }, ({ payload }) => {
      const revision = toRevision(payload);

      if (!payload || !revision) {
        return;
      }

      if (revision <= connectedAt || revision <= (seenRevisions[revisionKey] ?? 0)) {
        return;
      }

      seenRevisions[revisionKey] = revision;
      onSignal(payload as AdminRealtimeSignal);
    })
    .subscribe();
};

const bindPresenceChannel = (
  channelName: string,
  onPresenceChange: (presence: { count: number; onlineUserIds: string[] }) => void,
) => {
  if (!adminSupabaseClient) {
    return null;
  }

  const extractOnlineUserIds = (presenceState: Record<string, PresenceMeta[]>) => {
    const userIds = new Set<string>();

    Object.entries(presenceState).forEach(([presenceKey, presences]) => {
      let matchedTrackedUser = false;

      presences.forEach((presence) => {
        const trackedUserId =
          typeof presence.userId === 'string' ? presence.userId.trim() : '';

        if (!trackedUserId) {
          return;
        }

        matchedTrackedUser = true;
        userIds.add(trackedUserId);
      });

      if (!matchedTrackedUser && presenceKey.trim()) {
        userIds.add(presenceKey.trim());
      }
    });

    return [...userIds];
  };

  const channel = adminSupabaseClient.channel(channelName);

  const emitPresence = () => {
    const presenceState = channel.presenceState<PresenceMeta>();
    const onlineUserIds = extractOnlineUserIds(presenceState);

    onPresenceChange({
      count: onlineUserIds.length,
      onlineUserIds,
    });
  };

  return channel
    .on('presence', { event: 'sync' }, emitPresence)
    .on('presence', { event: 'join' }, emitPresence)
    .on('presence', { event: 'leave' }, emitPresence)
    .subscribe();
};

export const adminRealtimeService = {
  async connect(handlers: AdminRealtimeHandlers) {
    const token = localStorage.getItem('admin_token');

    if (!token || !isAdminSupabaseRealtimeEnabled() || !adminSupabaseClient) {
      return () => undefined;
    }

    try {
      const realtimeSession: AdminRealtimeSessionPayload = await adminService.getRealtimeSession(token);

      if (!realtimeSession.enabled || !realtimeSession.channels) {
        return () => undefined;
      }

      const connectedAt = Date.now();
      const seenRevisions: Record<string, number> = {};
      const channels: Array<RealtimeChannel | null> = [];

      if (realtimeSession.channels.adminPresence && handlers.onPresenceChange) {
        channels.push(
          bindPresenceChannel(
            realtimeSession.channels.adminPresence,
            handlers.onPresenceChange,
          ),
        );
      }

      if (realtimeSession.channels.adminDashboard && handlers.onDashboardRefresh) {
        channels.push(
          bindAdminBroadcast(
            realtimeSession.channels.adminDashboard,
            connectedAt,
            seenRevisions,
            handlers.onDashboardRefresh,
          ),
        );
      }

      if (realtimeSession.channels.adminUsers && handlers.onUsersRefresh) {
        channels.push(
          bindAdminBroadcast(
            realtimeSession.channels.adminUsers,
            connectedAt,
            seenRevisions,
            handlers.onUsersRefresh,
          ),
        );
      }

      return () => {
        channels.forEach((channel) => {
          if (channel && adminSupabaseClient) {
            void adminSupabaseClient.removeChannel(channel);
          }
        });
      };
    } catch (error) {
      console.warn('Admin Supabase realtime connection was skipped.', error);
      return () => undefined;
    }
  },
};
