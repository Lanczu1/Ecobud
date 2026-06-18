import {
  type PresenceAppState,
  type PresenceConnectionState,
  type PrismaClient,
} from '@prisma/client';
import { randomUUID } from 'crypto';
import { HttpError } from '../http/errorResponder';
import { prisma } from '../prismaClient';
import { type AccessRole } from '../security/tokenService';
import { supabaseRealtimeService } from './supabaseRealtimeService';

export const PRESENCE_HEARTBEAT_INTERVAL_MS = 45_000;
export const PRESENCE_STALE_TTL_MS = 2 * 60_000;

interface PresenceMutationInput {
  userId: string;
  appState: PresenceAppState;
  connectionState: PresenceConnectionState;
  sessionId?: string | null;
}

interface PresenceBroadcastInput {
  actorRole?: AccessRole | 'system';
  actorUserId?: string;
  entityId?: string | null;
  reason: string;
}

export interface PresenceSessionSnapshot {
  sessionId: string;
  userId: string;
  isOnline: boolean;
  connectedAt: string;
  lastSeenAt: string;
  updatedAt: string;
  disconnectedAt: string | null;
  expiresAt: string;
  appState: PresenceAppState;
  connectionState: PresenceConnectionState;
}

const createExpiryDate = (now: Date) => new Date(now.getTime() + PRESENCE_STALE_TTL_MS);

const canStayOnline = (
  appState: PresenceAppState,
  connectionState: PresenceConnectionState,
) => appState === 'active' && connectionState !== 'offline' && connectionState !== 'stale';

const toSnapshot = (session: {
  sessionId: string;
  userId: string;
  isOnline: boolean;
  connectedAt: Date;
  lastSeenAt: Date;
  updatedAt: Date;
  disconnectedAt: Date | null;
  expiresAt: Date;
  appState: PresenceAppState;
  connectionState: PresenceConnectionState;
}): PresenceSessionSnapshot => ({
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

export class PresenceService {
  constructor(private readonly database: PrismaClient = prisma) {}

  async connectSession(
    input: PresenceMutationInput,
    broadcast?: PresenceBroadcastInput,
  ) {
    await this.cleanupStaleSessions({ publish: false });

    const now = new Date();
    const nextSessionId = input.sessionId?.trim() || randomUUID();
    const existingSession = await this.database.presenceSession.findUnique({
      where: { sessionId: nextSessionId },
    });

    if (existingSession && existingSession.userId !== input.userId) {
      throw new HttpError(409, 'Presence session ownership mismatch.');
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
    } as const;

    let session;
    if (existingSession && existingSession.isOnline) {
      session = await this.database.presenceSession.update({
        where: { sessionId: nextSessionId },
        data: {
          ...baseData,
          connectedAt: existingSession.connectedAt,
        },
      });
    } else {
      session = await this.database.presenceSession.upsert({
        where: { sessionId: nextSessionId },
        create: {
          sessionId: nextSessionId,
          connectedAt: now,
          ...baseData,
        },
        update: {
          ...baseData,
          connectedAt: now,
        },
      });
    }

    const shouldPublish =
      !existingSession ||
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

  async heartbeatSession(
    input: PresenceMutationInput,
    broadcast?: PresenceBroadcastInput,
  ) {
    await this.cleanupStaleSessions({ publish: false });

    if (!input.sessionId?.trim()) {
      return this.connectSession(input, broadcast);
    }

    if (!canStayOnline(input.appState, input.connectionState)) {
      return this.disconnectSession(
        {
          userId: input.userId,
          sessionId: input.sessionId,
          appState: input.appState,
          connectionState: input.connectionState === 'stale' ? 'stale' : 'offline',
        },
        broadcast,
      );
    }

    const now = new Date();
    const existingSession = await this.database.presenceSession.findUnique({
      where: { sessionId: input.sessionId },
    });

    if (!existingSession) {
      return this.connectSession(input, broadcast);
    }

    if (existingSession.userId !== input.userId) {
      throw new HttpError(409, 'Presence session ownership mismatch.');
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

    const shouldPublish =
      !existingSession.isOnline ||
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

  async disconnectSession(
    input: PresenceMutationInput,
    broadcast?: PresenceBroadcastInput,
  ) {
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
      throw new HttpError(409, 'Presence session ownership mismatch.');
    }

    const now = new Date();
    const nextConnectionState =
      input.connectionState === 'stale' ? 'stale' : 'offline';

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

    const shouldPublish =
      existingSession.isOnline ||
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

  async cleanupStaleSessions(options?: { publish?: boolean }) {
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

  private async publishPresenceRefresh(input: PresenceBroadcastInput) {
    await supabaseRealtimeService.publishAdminSectionBundle(['dashboard', 'users'], {
      actorRole: input.actorRole ?? 'system',
      actorUserId: input.actorUserId,
      entityId: input.entityId ?? undefined,
      reason: input.reason,
    });
  }
}

export const presenceService = new PresenceService();
