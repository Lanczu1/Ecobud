import { createHmac } from 'crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { AccessRole } from '../security/tokenService';

export type RealtimeSection = 'learn' | 'challenges' | 'tracker';
export type AdminRealtimeSection = 'dashboard' | 'users';
type RealtimeActorRole = AccessRole | 'system';

interface RealtimeSignalInput {
  actorRole?: RealtimeActorRole;
  actorUserId?: string;
  entityId?: string;
  reason: string;
}

interface RealtimeNoticeInput {
  level?: 'info' | 'success' | 'warning';
  message: string;
  scope: 'moderation' | 'learn' | 'challenge' | 'tracker';
  title: string;
}

interface RealtimeChannelMap {
  adminDashboard?: string;
  adminPresence?: string;
  adminUsers?: string;
  globalChallenges: string;
  globalLearn: string;
  presenceMembers?: string;
  userChallenges: string;
  userLearn: string;
  userNotice: string;
  userTracker: string;
}

const GLOBAL_CHANNELS = {
  challenges: 'ecobud:global:challenges',
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

  getSession(
    userId: string,
    role: AccessRole = 'user',
  ): { enabled: boolean; channels: RealtimeChannelMap | null } {
    if (!this.isEnabled()) {
      return {
        enabled: false,
        channels: null,
      };
    }

    const channels: RealtimeChannelMap = {
      globalChallenges: GLOBAL_CHANNELS.challenges,
      globalLearn: GLOBAL_CHANNELS.learn,
      presenceMembers: PRESENCE_CHANNELS.members,
      userChallenges: this.buildUserChannel(userId, 'challenges'),
      userLearn: this.buildUserChannel(userId, 'learn'),
      userNotice: this.buildUserChannel(userId, 'notice'),
      userTracker: this.buildUserChannel(userId, 'tracker'),
    };

    if (role === 'moderator' || role === 'admin') {
      channels.adminDashboard = ADMIN_CHANNELS.dashboard;
      channels.adminPresence = PRESENCE_CHANNELS.members;
      channels.adminUsers = ADMIN_CHANNELS.users;
    }

    return {
      enabled: true,
      channels,
    };
  }

  async publishGlobalSectionRefresh(section: RealtimeSection, input: RealtimeSignalInput) {
    const channel =
      section === 'learn' ? GLOBAL_CHANNELS.learn : GLOBAL_CHANNELS.challenges;

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
      title: input.title,
      userId,
    });
  }

  async publishAdminSectionRefresh(
    section: AdminRealtimeSection,
    input: RealtimeSignalInput,
  ) {
    const channel =
      section === 'dashboard' ? ADMIN_CHANNELS.dashboard : ADMIN_CHANNELS.users;

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

  private async publish(channelName: string, event: string, payload: Record<string, unknown>) {
    const client = this.getClient();

    if (!client) {
      return false;
    }

    const channel = client.channel(channelName);

    try {
      const response = await channel.httpSend(event, {
        ...payload,
        revision: Date.now(),
        updatedAt: new Date().toISOString(),
      });

      if (!response.success) {
        console.error(
          `Supabase realtime publish failed for ${channelName}.`,
          response.status,
          response.error,
        );
      }

      return response.success;
    } catch (error) {
      console.error(`Failed to publish Supabase realtime payload for ${channelName}.`, error);
      return false;
    } finally {
      await client.removeChannel(channel);
    }
  }
}

export const supabaseRealtimeService = new SupabaseRealtimeService();
