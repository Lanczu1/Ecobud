"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.presenceQueryService = exports.PresenceQueryService = void 0;
const client_1 = require("@prisma/client");
const prismaClient_1 = require("../prismaClient");
const presenceService_1 = require("./presenceService");
const asEnumOrNull = (value, candidates) => {
    if (!value) {
        return null;
    }
    return candidates.includes(value) ? value : null;
};
class PresenceQueryService {
    database;
    presenceService;
    constructor(database = prismaClient_1.prisma) {
        this.database = database;
        this.presenceService = new presenceService_1.PresenceService(database);
    }
    async getPresenceOverview(snapshotDate = new Date()) {
        const startOfToday = this.getStartOfToday(snapshotDate);
        await this.presenceService.cleanupStaleSessions();
        const [activeToday, presenceSummaryRows] = await Promise.all([
            this.getActiveTodayCount(snapshotDate, startOfToday),
            this.getPresenceSummaryRows(snapshotDate),
        ]);
        const onlineSummaryRows = presenceSummaryRows.filter((row) => row.isOnline &&
            row.lastSeenAt &&
            row.lastSeenAt.getTime() >= startOfToday.getTime());
        const users = await this.database.user.findMany({
            where: {
                id: {
                    in: onlineSummaryRows.map((row) => row.userId),
                },
            },
            orderBy: {
                createdAt: 'desc',
            },
            select: {
                id: true,
                name: true,
                email: true,
                role: true,
                status: true,
                points: true,
                currentStreak: true,
                profile: {
                    select: {
                        displayName: true,
                        avatarUrl: true,
                    },
                },
            },
        });
        const presenceMap = this.buildPresenceMap(presenceSummaryRows);
        const userMap = new Map(users.map((user) => [user.id, user]));
        const onlineUsers = onlineSummaryRows
            .map((row) => {
            const user = userMap.get(row.userId);
            const summary = presenceMap.get(row.userId);
            if (!user || !summary) {
                return null;
            }
            return this.toAdminPresenceUser(user, summary);
        })
            .filter((user) => Boolean(user))
            .sort((left, right) => {
            const rightTs = right.lastSeenAt ? new Date(right.lastSeenAt).getTime() : 0;
            const leftTs = left.lastSeenAt ? new Date(left.lastSeenAt).getTime() : 0;
            return rightTs - leftTs;
        });
        return {
            activeToday,
            onlineUsers,
            snapshotDate: snapshotDate.toISOString(),
        };
    }
    async getAdminUsers(snapshotDate = new Date()) {
        await this.presenceService.cleanupStaleSessions();
        const [users, presenceSummaryRows] = await Promise.all([
            this.database.user.findMany({
                orderBy: {
                    createdAt: 'desc',
                },
                select: {
                    id: true,
                    name: true,
                    email: true,
                    role: true,
                    status: true,
                    points: true,
                    currentStreak: true,
                    lastActionDate: true,
                    createdAt: true,
                    profile: {
                        select: {
                            displayName: true,
                            avatarUrl: true,
                        },
                    },
                },
            }),
            this.getPresenceSummaryRows(snapshotDate),
        ]);
        const presenceMap = this.buildPresenceMap(presenceSummaryRows);
        return users.map((user) => {
            const summary = presenceMap.get(user.id);
            return {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
                status: user.status,
                points: user.points,
                currentStreak: user.currentStreak,
                profile: user.profile,
                createdAt: user.createdAt.toISOString(),
                lastActionDate: user.lastActionDate?.toISOString() ?? null,
                isOnlineNow: summary?.isOnline ?? false,
                lastSeenAt: summary?.lastSeenAt ?? user.lastActionDate?.toISOString() ?? null,
                connectedAt: summary?.connectedAt ?? null,
                activeSessionCount: summary?.activeSessionCount ?? 0,
                appState: summary?.appState ?? null,
                connectionState: summary?.connectionState ?? null,
            };
        });
    }
    async getActiveTodayCount(snapshotDate, startOfToday) {
        const rows = await this.database.$queryRaw(client_1.Prisma.sql `
      SELECT COUNT(DISTINCT ps.user_id)::int AS "activeToday"
      FROM presence_sessions ps
      WHERE ps.is_online = TRUE
        AND ps.expires_at > ${snapshotDate}
        AND ps.last_seen_at >= ${startOfToday}
    `);
        return Number(rows[0]?.activeToday ?? 0);
    }
    async getPresenceSummaryRows(snapshotDate) {
        return this.database.$queryRaw(client_1.Prisma.sql `
      SELECT
        ps.user_id AS "userId",
        MAX(ps.last_seen_at) AS "lastSeenAt",
        MAX(ps.connected_at) FILTER (
          WHERE ps.is_online = TRUE AND ps.expires_at > ${snapshotDate}
        ) AS "connectedAt",
        COUNT(*) FILTER (
          WHERE ps.is_online = TRUE AND ps.expires_at > ${snapshotDate}
        )::int AS "sessionCount",
        COALESCE(
          BOOL_OR(ps.is_online = TRUE AND ps.expires_at > ${snapshotDate}),
          FALSE
        ) AS "isOnline",
        (
          ARRAY_AGG(
            ps.connection_state
            ORDER BY
              CASE
                WHEN ps.is_online = TRUE AND ps.expires_at > ${snapshotDate} THEN 0
                ELSE 1
              END,
              ps.last_seen_at DESC
          )
        )[1]::text AS "connectionState",
        (
          ARRAY_AGG(
            ps.app_state
            ORDER BY
              CASE
                WHEN ps.is_online = TRUE AND ps.expires_at > ${snapshotDate} THEN 0
                ELSE 1
              END,
              ps.last_seen_at DESC
          )
        )[1]::text AS "appState"
      FROM presence_sessions ps
      GROUP BY ps.user_id
    `);
    }
    buildPresenceMap(rows) {
        return new Map(rows.map((row) => [
            row.userId,
            {
                userId: row.userId,
                lastSeenAt: row.lastSeenAt?.toISOString() ?? null,
                connectedAt: row.connectedAt?.toISOString() ?? null,
                activeSessionCount: Number(row.sessionCount ?? 0),
                isOnline: Boolean(row.isOnline),
                connectionState: asEnumOrNull(row.connectionState, [
                    'online',
                    'offline',
                    'reconnecting',
                    'stale',
                ]),
                appState: asEnumOrNull(row.appState, ['active', 'background', 'inactive']),
            },
        ]));
    }
    toAdminPresenceUser(user, summary) {
        return {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            status: user.status,
            points: user.points,
            currentStreak: user.currentStreak,
            profile: user.profile,
            createdAt: user.createdAt?.toISOString() ?? null,
            lastActionDate: user.lastActionDate?.toISOString() ?? null,
            isOnlineNow: summary.isOnline,
            lastSeenAt: summary.lastSeenAt,
            connectedAt: summary.connectedAt,
            activeSessionCount: summary.activeSessionCount,
            appState: summary.appState,
            connectionState: summary.connectionState,
        };
    }
    getStartOfToday(snapshotDate) {
        const startOfToday = new Date(snapshotDate);
        startOfToday.setHours(0, 0, 0, 0);
        return startOfToday;
    }
}
exports.PresenceQueryService = PresenceQueryService;
exports.presenceQueryService = new PresenceQueryService();
