import { Prisma, PrismaClient } from '@prisma/client';
import { prisma } from '../prismaClient';
import { TransparencyHasher } from '../utils/transparencyHasher';

type DatabaseSession = Prisma.TransactionClient | PrismaClient;

interface LogPayload {
  userId: string;
  actionType: string;
  pointsAwarded: number;
  metadata?: Record<string, unknown>;
}

export class TransparencyLedgerService {
  async appendLog(session: DatabaseSession, payload: LogPayload) {
    const lastLog = await session.transparencyLog.findFirst({
      orderBy: { timestamp: 'desc' },
    });

    const previousHash = lastLog?.currentHash ?? 'GENESIS_HASH_ECOBUD';
    const timestamp = new Date().toISOString();
    const currentHash = TransparencyHasher.generateBlockHash(
      {
        userId: payload.userId,
        actionType: payload.actionType,
        pointsAwarded: payload.pointsAwarded,
        metadata: JSON.stringify(payload.metadata ?? {}),
        timestamp,
      },
      previousHash,
    );

    return session.transparencyLog.create({
      data: {
        userId: payload.userId,
        actionType: payload.actionType,
        publicLabel: TransparencyHasher.anonymizeUserForPublicBoard(payload.userId),
        pointsAwarded: payload.pointsAwarded,
        metadata: JSON.stringify(payload.metadata ?? {}),
        previousHash,
        currentHash,
        timestamp: new Date(timestamp),
      },
    });
  }

  async getPublicMetrics() {
    const [totalActions, activeParticipants, rewards] = await Promise.all([
      prisma.transparencyLog.count(),
      prisma.user.count({
        where: {
          role: {
            in: ['user', 'moderator'],
          },
          status: 'active',
        },
      }),
      prisma.transparencyLog.aggregate({
        _sum: {
          pointsAwarded: true,
        },
      }),
    ]);

    return {
      totalActions,
      totalRewards: rewards._sum.pointsAwarded ?? 0,
      activeParticipants,
    };
  }

  async getLogs(page: number, pageSize: number, userId?: string) {
    const skip = (page - 1) * pageSize;
    const where = userId ? { userId } : undefined;

    const [items, total] = await Promise.all([
      prisma.transparencyLog.findMany({
        where,
        orderBy: { timestamp: 'desc' },
        skip,
        take: pageSize,
      }),
      prisma.transparencyLog.count({ where }),
    ]);

    return {
      items: items.map((item) => ({
        id: item.id,
        publicLabel: item.publicLabel,
        actionType: item.actionType,
        pointsAwarded: item.pointsAwarded,
        currentHash: item.currentHash,
        previousHash: item.previousHash,
        timestamp: item.timestamp,
        metadata: item.metadata ? JSON.parse(item.metadata) : {},
      })),
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      },
    };
  }
}
