import { createHmac } from 'crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { AccessRole } from '../security/tokenService';
import { adminLiveEvents } from './adminLiveEvents';
import { residentLiveEvents } from './residentLiveEvents';

export type AdminRealtimeSection = 'dashboard' | 'users';
export type RealtimeSection = 'learn' | 'challenges' | 'events' | 'tracker' | 'swap';
type RealtimeActorRole = AccessRole | 'system';

type SwapEventType = 'request' | 'message' | 'status' | 'listing';

interface SwapEventInput {
  actorUserId: string;
  targetUserId: string;
  eventType: SwapEventType;
  listingId?: string;
  swapRequestId?: string;
}

interface RealtimeSignalInput {
  actorRole?: RealtimeActorRole;
  actorUserId?: string;
  entityId?: string;
  reason: string;
}

interface RealtimeNoticeInput {
  relatedType?: string;
  level?: 'info' | 'success' | 'warning';
  message: string;
  scope: 'notifications' | 'moderation' | 'learn' | 'challenge' | 'tracker';
  title: string;
}

interface RealtimeChannelMap {
  adminDashboard?: string;
  adminPresence?: string;
  adminUsers?: string;
  globalChallenges: string;
  globalLearn: string;
  globalEvents: string;
  presenceMembers?: string;
  userChallenges: string;
  userLearn: string;
  userNotice: string;
  userEvents: string;
  userSwap: string;
  userTracker: string;
}

const GLOBAL_CHANNELS = {
  challenges: 'ecobud:global:challenges',
  events: 'ecobud:global:events',
  learn: 'ecobud:global:learn',
} as const;

const ADMIN_CHANNELS = {
  dashboard: 'ecobud:admin:dashboard',
  users: 'ecobud:admin:users',
} as const;

const PRESENCE_CHANNELS = {
  members: 'ecobud:presence:members',
} as const;

const trimValue = (value?: string | null) => value?.trim() || null;

const getSupabaseConfig = () => {
  const url = trimValue(process.env.SUPABASE_URL);
  const serviceRoleKey = trimValue(process.env.SUPABASE_SERVICE_ROLE_KEY);
  const channelSecret =
    trimValue(process.env.SUPABASE_REALTIME_CHANNEL_SECRET) ??
    serviceRoleKey ??
    null;

  if (!url || !serviceRoleKey || !channelSecret) {
    return null;
  }

  return {
    channelSecret,
    serviceRoleKey,
    url,
  };
};

class SupabaseRealtimeService {
  private client: SupabaseClient | null | undefined;
  private channelSecret: string | null | undefined;

  private getConfig() {
    return getSupabaseConfig();
  }

  private getClient() {
    if (this.client !== undefined) {
      return this.client;
    }

    const config = this.getConfig();

    if (!config) {
      this.client = null;
      this.channelSecret = null;
      return this.client;
    }

    try {
      this.client = createClient(config.url, config.serviceRoleKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      });
      this.channelSecret = config.channelSecret;
    } catch (error) {
      console.error('Supabase Realtime service failed to initialize.', error);
      this.client = null;
      this.channelSecret = null;
    }

    return this.client;
  }

  private getChannelSecret() {
    if (this.channelSecret !== undefined) {
      return this.channelSecret;
    }

    this.getClient();
    return this.channelSecret ?? null;
  }

  isEnabled() {
    return Boolean(this.getClient() && this.getChannelSecret());
  }

  getSession(_userId: string, _role: AccessRole = 'user') {
    return { enabled: true, channels: null, transport: 'api-stream' as const };
  }

  async publishGlobalSectionRefresh(section: RealtimeSection, input: RealtimeSignalInput) {
    const channel = section === 'learn' ? GLOBAL_CHANNELS.learn
      : section === 'events' ? GLOBAL_CHANNELS.events
      : GLOBAL_CHANNELS.challenges;
    adminLiveEvents.emit(section === 'learn' ? ['lessons'] : section === 'events' ? ['events'] : section === 'swap' ? ['giveget'] : section === 'tracker' ? 'all' : ['challenges']);

    return this.publish(channel, 'refresh', {
      actorRole: input.actorRole ?? 'system',
      actorUserId: input.actorUserId ?? null,
      audience: 'global',
      channel: section,
      entityId: input.entityId ?? null,
      reason: input.reason,
    });
  }

  async publishUserSectionRefresh(
    userId: string,
    section: RealtimeSection,
    input: RealtimeSignalInput,
  ) {
    return this.publish(this.buildUserChannel(userId, section), 'refresh', {
      actorRole: input.actorRole ?? 'system',
      actorUserId: input.actorUserId ?? null,
      audience: 'user',
      channel: section,
      entityId: input.entityId ?? null,
      reason: input.reason,
      userId,
    });
  }

  async publishUserSectionBundle(
    userId: string,
    sections: RealtimeSection[],
    input: RealtimeSignalInput,
  ) {
    await Promise.all(
      sections.map((section) => this.publishUserSectionRefresh(userId, section, input)),
    );
  }

  async publishUserNotice(userId: string, input: RealtimeNoticeInput) {
    return this.publish(this.buildUserChannel(userId, 'notice'), 'notice', {
      level: input.level ?? 'info',
      message: input.message,
      scope: input.scope,
      relatedType: input.relatedType,
      title: input.title,
      userId,
    });
  }

  async publishUserEventsRefresh(userId: string, input: RealtimeSignalInput) {
    return this.publish(this.buildUserChannel(userId, 'events'), 'refresh', {
      actorRole: input.actorRole ?? 'system',
      actorUserId: input.actorUserId ?? null,
      audience: 'user',
      channel: 'events',
      entityId: input.entityId ?? null,
      reason: input.reason,
      userId,
    });
  }

  async publishAdminSectionRefresh(
    section: AdminRealtimeSection,
    input: RealtimeSignalInput,
  ) {
    const channel = section === 'dashboard' ? ADMIN_CHANNELS.dashboard : ADMIN_CHANNELS.users;
    // Presence changes come often and only matter to Users and the dashboard figures.
    adminLiveEvents.emit(input.reason.startsWith('presence-') ? ['presence'] : [section]);

    return this.publish(channel, 'refresh', {
      actorRole: input.actorRole ?? 'system',
      actorUserId: input.actorUserId ?? null,
      audience: 'admin',
      channel: section,
      entityId: input.entityId ?? null,
      reason: input.reason,
    });
  }

  async publishAdminSectionBundle(
    sections: AdminRealtimeSection[],
    input: RealtimeSignalInput,
  ) {
    await Promise.all(
      sections.map((section) => this.publishAdminSectionRefresh(section, input)),
    );
  }

  private buildUserChannel(
    userId: string,
    section: RealtimeSection | 'notice',
  ) {
    const secret = this.getChannelSecret() ?? 'ecobud-local-supabase-secret';
    const digest = createHmac('sha256', secret)
      .update(`${userId}:${section}`)
      .digest('hex')
      .slice(0, 24);

    return `ecobud:user:${section}:${digest}`;
  }

  async publishSwapEvent(input: SwapEventInput) {
    const channel = this.buildUserChannel(input.targetUserId, 'swap');
    return this.publish(channel, 'swap', {
      userId: input.targetUserId,
      actorUserId: input.actorUserId,
      eventType: input.eventType,
      listingId: input.listingId ?? null,
      swapRequestId: input.swapRequestId ?? null,
    });
  }

  private async publish(channelName: string, event: string, payload: Record<string, unknown>) {
    const envelope: Record<string, unknown> = { ...payload, revision: Date.now(), updatedAt: new Date().toISOString() };
    const locallyDelivered = payload.audience === 'global' || typeof payload.userId === 'string';
    if (payload.audience === 'global') {
      const { actorUserId, entityId, ...publicPayload } = envelope;
      residentLiveEvents.publish({ event, audience: 'global', payload: publicPayload });
    } else if (typeof payload.userId === 'string') {
      residentLiveEvents.publish({ event, audience: 'user', userId: payload.userId, payload: envelope });
    }
    const client = this.getClient();
    if (!client) return true;
    const channel = client.channel(channelName, { config: { private: true } });

    try {
      const response = await channel.httpSend(event, envelope);

      if (!response.success) {
        console.error(
          `Supabase realtime publish failed for ${channelName}.`,
          response.status,
          response.error,
        );
      }

      return response.success || locallyDelivered;
    } catch (error: any) {
      if (error?.name !== 'AbortError') {
        console.error(`Failed to publish Supabase realtime payload for ${channelName}.`, error);
      }
      return locallyDelivered;
    } finally {
      await client.removeChannel(channel);
    }
  }
}

export const supabaseRealtimeService = new SupabaseRealtimeService();

