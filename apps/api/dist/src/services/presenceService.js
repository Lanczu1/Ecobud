"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.presenceService = exports.PresenceService = exports.PRESENCE_STALE_TTL_MS = exports.PRESENCE_HEARTBEAT_INTERVAL_MS = void 0;
const crypto_1 = require("crypto");
const errorResponder_1 = require("../http/errorResponder");
const prismaClient_1 = require("../prismaClient");
const supabaseRealtimeService_1 = require("./supabaseRealtimeService");
exports.PRESENCE_HEARTBEAT_INTERVAL_MS = 45_000;
exports.PRESENCE_STALE_TTL_MS = 2 * 60_000;
const createExpiryDate = (now) => new Date(now.getTime() + exports.PRESENCE_STALE_TTL_MS);
const canStayOnline = (appState, connectionState) => appState === 'active' && connectionState !== 'offline' && connectionState !== 'stale';
const toSnapshot = (session) => ({
    sessionId: session.sessionId,
    userId: session.userId,
    isOnline: session.isOnline,
    connectedAt: session.connectedAt.toISOString(),
    lastSeenAt: session.lastSeenAt.toISOString(),
    updatedAt: session.updatedAt.toISOString(),
    disconnectedAt: session.disconnectedAt?.toISOString() ?? null,
    expiresAt: session.expiresAt.toISOString(),
    appState: session.appState,
    connectionState: session.connectionState,
});
class PresenceService {
    database;
    constructor(database = prismaClient_1.prisma) {
        this.database = database;
    }
    async connectSession(input, broadcast) {
        await this.cleanupStaleSessions({ publish: false });
        const now = new Date();
        const nextSessionId = input.sessionId?.trim() || (0, crypto_1.randomUUID)();
        const existingSession = await this.database.presenceSession.findUnique({
            where: { sessionId: nextSessionId },
        });
        if (existingSession && existingSession.userId !== input.userId) {
            throw new errorResponder_1.HttpError(409, 'Presence session ownership mismatch.');
        }
        const baseData = {
            userId: input.userId,
            isOnline: true,
            lastSeenAt: now,
            disconnectedAt: null,
            expiresAt: createExpiryDate(now),
            appState: input.appState,
            connectionState: canStayOnline(input.appState, input.connectionState)
                ? input.connectionState
                : 'online',
        };
        const session = existingSession
            ? await this.database.presenceSession.update({
                where: { sessionId: nextSessionId },
                data: {
                    ...baseData,
                    connectedAt: existingSession.isOnline ? existingSession.connectedAt : now,
                },
            })
            : await this.database.presenceSession.create({
                data: {
                    sessionId: nextSessionId,
                    connectedAt: now,
                    ...baseData,
                },
            });
        const shouldPublish = !existingSession ||
            !existingSession.isOnline ||
            existingSession.appState !== session.appState ||
            existingSession.connectionState !== session.connectionState;
        if (shouldPublish) {
            await this.publishPresenceRefresh({
                actorRole: broadcast?.actorRole ?? 'system',
                actorUserId: broadcast?.actorUserId ?? input.userId,
                entityId: broadcast?.entityId ?? input.userId,
                reason: broadcast?.reason ?? 'presence-connected',
            });
        }
        return toSnapshot(session);
    }
    async heartbeatSession(input, broadcast) {
        await this.cleanupStaleSessions({ publish: false });
        if (!input.sessionId?.trim()) {
            return this.connectSession(input, broadcast);
        }
        if (!canStayOnline(input.appState, input.connectionState)) {
            return this.disconnectSession({
                userId: input.userId,
                sessionId: input.sessionId,
                appState: input.appState,
                connectionState: input.connectionState === 'stale' ? 'stale' : 'offline',
            }, broadcast);
        }
        const now = new Date();
        const existingSession = await this.database.presenceSession.findUnique({
            where: { sessionId: input.sessionId },
        });
        if (!existingSession) {
            return this.connectSession(input, broadcast);
        }
        if (existingSession.userId !== input.userId) {
            throw new errorResponder_1.HttpError(409, 'Presence session ownership mismatch.');
        }
        const session = await this.database.presenceSession.update({
            where: { sessionId: input.sessionId },
            data: {
                isOnline: true,
                lastSeenAt: now,
                disconnectedAt: null,
                expiresAt: createExpiryDate(now),
                appState: input.appState,
                connectionState: input.connectionState,
            },
        });
        const shouldPublish = !existingSession.isOnline ||
            existingSession.appState !== session.appState ||
            existingSession.connectionState !== session.connectionState;
        if (shouldPublish) {
            await this.publishPresenceRefresh({
                actorRole: broadcast?.actorRole ?? 'system',
                actorUserId: broadcast?.actorUserId ?? input.userId,
                entityId: broadcast?.entityId ?? input.userId,
                reason: broadcast?.reason ?? 'presence-heartbeat',
            });
        }
        return toSnapshot(session);
    }
    async disconnectSession(input, broadcast) {
        if (!input.sessionId?.trim()) {
            return null;
        }
        const existingSession = await this.database.presenceSession.findUnique({
            where: { sessionId: input.sessionId },
        });
        if (!existingSession) {
            return null;
        }
        if (existingSession.userId !== input.userId) {
            throw new errorResponder_1.HttpError(409, 'Presence session ownership mismatch.');
        }
        const now = new Date();
        const nextConnectionState = input.connectionState === 'stale' ? 'stale' : 'offline';
        const session = await this.database.presenceSession.update({
            where: { sessionId: input.sessionId },
            data: {
                isOnline: false,
                lastSeenAt: now,
                disconnectedAt: now,
                expiresAt: now,
                appState: input.appState,
                connectionState: nextConnectionState,
            },
        });
        const shouldPublish = existingSession.isOnline ||
            existingSession.appState !== session.appState ||
            existingSession.connectionState !== session.connectionState;
        if (shouldPublish) {
            await this.publishPresenceRefresh({
                actorRole: broadcast?.actorRole ?? 'system',
                actorUserId: broadcast?.actorUserId ?? input.userId,
                entityId: broadcast?.entityId ?? input.userId,
                reason: broadcast?.reason ?? 'presence-disconnected',
            });
        }
        return toSnapshot(session);
    }
    async cleanupStaleSessions(options) {
        const now = new Date();
        const staleSessions = await this.database.presenceSession.findMany({
            where: {
                isOnline: true,
                expiresAt: {
                    lte: now,
                },
            },
            select: {
                sessionId: true,
            },
        });
        if (staleSessions.length === 0) {
            return 0;
        }
        const result = await this.database.presenceSession.updateMany({
            where: {
                sessionId: {
                    in: staleSessions.map((session) => session.sessionId),
                },
            },
            data: {
                isOnline: false,
                disconnectedAt: now,
                expiresAt: now,
                connectionState: 'stale',
            },
        });
        if ((options?.publish ?? true) && result.count > 0) {
            await this.publishPresenceRefresh({
                actorRole: 'system',
                reason: 'presence-stale-cleanup',
            });
        }
        return result.count;
    }
    async publishPresenceRefresh(input) {
        await supabaseRealtimeService_1.supabaseRealtimeService.publishAdminSectionBundle(['dashboard', 'users'], {
            actorRole: input.actorRole ?? 'system',
            actorUserId: input.actorUserId,
            entityId: input.entityId ?? undefined,
            reason: input.reason,
        });
    }
}
exports.PresenceService = PresenceService;
exports.presenceService = new PresenceService();
