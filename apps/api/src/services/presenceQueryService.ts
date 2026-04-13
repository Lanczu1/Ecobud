import { Prisma, type PresenceAppState, type PresenceConnectionState, type PrismaClient } from '@prisma/client';
import { prisma } from '../prismaClient';
import { PresenceService } from './presenceService';

interface PresenceAggregateRow {
  userId: string;
  lastSeenAt: Date | null;
  connectedAt: Date | null;
  sessionCount: number;
  isOnline: boolean;
  connectionState: string | null;
  appState: string | null;
}

export interface PresenceSummary {
  userId: string;
  lastSeenAt: string | null;
  connectedAt: string | null;
  activeSessionCount: number;
  isOnline: boolean;
  connectionState: PresenceConnectionState | null;
  appState: PresenceAppState | null;
}

export interface AdminPresenceUser {
  id: string;
  name: string;
  email: string;
  role: 'user' | 'moderator' | 'admin';
  status: 'active' | 'pending' | 'suspended';
  points: number;
  currentStreak: number;
  profile: {
    displayName: string;
    avatarUrl: string | null;
  } | null;
  createdAt: string | null;
  lastActionDate: string | null;
  isOnlineNow: boolean;
  lastSeenAt: string | null;
  connectedAt: string | null;
  activeSessionCount: number;
  appState: PresenceAppState | null;
  connectionState: PresenceConnectionState | null;
}

export interface AdminPresenceOverview {
  activeToday: number;
  onlineUsers: AdminPresenceUser[];
  snapshotDate: string;
}

const asEnumOrNull = <TValue extends string>(
  value: string | null,
  candidates: readonly TValue[],
): TValue | null => {
  if (!value) {
    return null;
  }

  return candidates.includes(value as TValue) ? (value as TValue) : null;
};

export class PresenceQueryService {
  private readonly presenceService: PresenceService;

  constructor(private readonly database: PrismaClient = prisma) {
    this.presenceService = new PresenceService(database);
  }

  async getPresenceOverview(snapshotDate: Date = new Date()): Promise<AdminPresenceOverview> {
    const startOfToday = this.getStartOfToday(snapshotDate);
    await this.presenceService.cleanupStaleSessions();

    const [activeToday, presenceSummaryRows] = await Promise.all([
      this.getActiveTodayCount(snapshotDate, startOfToday),
      this.getPresenceSummaryRows(snapshotDate),
    ]);

    const onlineSummaryRows = presenceSummaryRows.filter(
      (row) =>
        row.isOnline &&
        row.lastSeenAt &&
        row.lastSeenAt.getTime() >= startOfToday.getTime(),
    );

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
      .filter((user): user is AdminPresenceUser => Boolean(user))
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

  async getAdminUsers(snapshotDate: Date = new Date()): Promise<AdminPresenceUser[]> {
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

  private async getActiveTodayCount(snapshotDate: Date, startOfToday: Date) {
    const rows = await this.database.$queryRaw<Array<{ activeToday: number }>>(Prisma.sql`
      SELECT COUNT(DISTINCT ps.user_id)::int AS "activeToday"
      FROM presence_sessions ps
      WHERE ps.is_online = TRUE
        AND ps.expires_at > ${snapshotDate}
        AND ps.last_seen_at >= ${startOfToday}
    `);

    return Number(rows[0]?.activeToday ?? 0);
  }

  private async getPresenceSummaryRows(snapshotDate: Date) {
    return this.database.$queryRaw<PresenceAggregateRow[]>(Prisma.sql`
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

  private buildPresenceMap(rows: PresenceAggregateRow[]) {
    return new Map<string, PresenceSummary>(
      rows.map((row) => [
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
      ]),
    );
  }

  private toAdminPresenceUser(
    user: {
      id: string;
      name: string;
      email: string;
      role: 'user' | 'moderator' | 'admin';
      status: 'active' | 'pending' | 'suspended';
      points: number;
      currentStreak: number;
      profile: {
        displayName: string;
        avatarUrl: string | null;
      } | null;
      createdAt?: Date;
      lastActionDate?: Date | null;
    },
    summary: PresenceSummary,
  ): AdminPresenceUser {
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

  private getStartOfToday(snapshotDate: Date) {
    const startOfToday = new Date(snapshotDate);
    startOfToday.setHours(0, 0, 0, 0);
    return startOfToday;
  }
}

export const presenceQueryService = new PresenceQueryService();
