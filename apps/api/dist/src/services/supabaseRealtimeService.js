"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.supabaseRealtimeService = void 0;
const crypto_1 = require("crypto");
const supabase_js_1 = require("@supabase/supabase-js");
const GLOBAL_CHANNELS = {
    challenges: 'ecobud:global:challenges',
    learn: 'ecobud:global:learn',
};
const ADMIN_CHANNELS = {
    dashboard: 'ecobud:admin:dashboard',
    users: 'ecobud:admin:users',
};
const trimValue = (value) => value?.trim() || null;
const getSupabaseConfig = () => {
    const url = trimValue(process.env.SUPABASE_URL);
    const serviceRoleKey = trimValue(process.env.SUPABASE_SERVICE_ROLE_KEY);
    const channelSecret = trimValue(process.env.SUPABASE_REALTIME_CHANNEL_SECRET) ??
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
    client;
    channelSecret;
    getConfig() {
        return getSupabaseConfig();
    }
    getClient() {
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
            this.client = (0, supabase_js_1.createClient)(config.url, config.serviceRoleKey, {
                auth: {
                    autoRefreshToken: false,
                    persistSession: false,
                },
            });
            this.channelSecret = config.channelSecret;
        }
        catch (error) {
            console.error('Supabase Realtime service failed to initialize.', error);
            this.client = null;
            this.channelSecret = null;
        }
        return this.client;
    }
    getChannelSecret() {
        if (this.channelSecret !== undefined) {
            return this.channelSecret;
        }
        this.getClient();
        return this.channelSecret ?? null;
    }
    isEnabled() {
        return Boolean(this.getClient() && this.getChannelSecret());
    }
    getSession(userId, role = 'user') {
        if (!this.isEnabled()) {
            return {
                enabled: false,
                channels: null,
            };
        }
        const channels = {
            globalChallenges: GLOBAL_CHANNELS.challenges,
            globalLearn: GLOBAL_CHANNELS.learn,
            userChallenges: this.buildUserChannel(userId, 'challenges'),
            userLearn: this.buildUserChannel(userId, 'learn'),
            userNotice: this.buildUserChannel(userId, 'notice'),
            userTracker: this.buildUserChannel(userId, 'tracker'),
        };
        if (role === 'moderator' || role === 'admin') {
            channels.adminDashboard = ADMIN_CHANNELS.dashboard;
            channels.adminUsers = ADMIN_CHANNELS.users;
        }
        return {
            enabled: true,
            channels,
        };
    }
    async publishGlobalSectionRefresh(section, input) {
        const channel = section === 'learn' ? GLOBAL_CHANNELS.learn : GLOBAL_CHANNELS.challenges;
        return this.publish(channel, 'refresh', {
            actorRole: input.actorRole ?? 'system',
            actorUserId: input.actorUserId ?? null,
            audience: 'global',
            channel: section,
            entityId: input.entityId ?? null,
            reason: input.reason,
        });
    }
    async publishUserSectionRefresh(userId, section, input) {
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
    async publishUserSectionBundle(userId, sections, input) {
        await Promise.all(sections.map((section) => this.publishUserSectionRefresh(userId, section, input)));
    }
    async publishUserNotice(userId, input) {
        return this.publish(this.buildUserChannel(userId, 'notice'), 'notice', {
            level: input.level ?? 'info',
            message: input.message,
            scope: input.scope,
            title: input.title,
            userId,
        });
    }
    async publishAdminSectionRefresh(section, input) {
        const channel = section === 'dashboard' ? ADMIN_CHANNELS.dashboard : ADMIN_CHANNELS.users;
        return this.publish(channel, 'refresh', {
            actorRole: input.actorRole ?? 'system',
            actorUserId: input.actorUserId ?? null,
            audience: 'admin',
            channel: section,
            entityId: input.entityId ?? null,
            reason: input.reason,
        });
    }
    async publishAdminSectionBundle(sections, input) {
        await Promise.all(sections.map((section) => this.publishAdminSectionRefresh(section, input)));
    }
    buildUserChannel(userId, section) {
        const secret = this.getChannelSecret() ?? 'ecobud-local-supabase-secret';
        const digest = (0, crypto_1.createHmac)('sha256', secret)
            .update(`${userId}:${section}`)
            .digest('hex')
            .slice(0, 24);
        return `ecobud:user:${section}:${digest}`;
    }
    async publish(channelName, event, payload) {
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
                console.error(`Supabase realtime publish failed for ${channelName}.`, response.status, response.error);
            }
            return response.success;
        }
        catch (error) {
            console.error(`Failed to publish Supabase realtime payload for ${channelName}.`, error);
            return false;
        }
        finally {
            await client.removeChannel(channel);
        }
    }
}
exports.supabaseRealtimeService = new SupabaseRealtimeService();
