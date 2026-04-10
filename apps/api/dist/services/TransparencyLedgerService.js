"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TransparencyLedgerService = void 0;
const prismaClient_1 = require("../prismaClient");
const transparencyHasher_1 = require("../utils/transparencyHasher");
class TransparencyLedgerService {
    async appendLog(session, payload) {
        const lastLog = await session.transparencyLog.findFirst({
            orderBy: { timestamp: 'desc' },
        });
        const previousHash = lastLog?.currentHash ?? 'GENESIS_HASH_ECOBUD';
        const timestamp = new Date().toISOString();
        const currentHash = transparencyHasher_1.TransparencyHasher.generateBlockHash({
            userId: payload.userId,
            actionType: payload.actionType,
            pointsAwarded: payload.pointsAwarded,
            metadata: JSON.stringify(payload.metadata ?? {}),
            timestamp,
        }, previousHash);
        return session.transparencyLog.create({
            data: {
                userId: payload.userId,
                actionType: payload.actionType,
                publicLabel: transparencyHasher_1.TransparencyHasher.anonymizeUserForPublicBoard(payload.userId),
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
            prismaClient_1.prisma.transparencyLog.count(),
            prismaClient_1.prisma.user.count({
                where: {
                    role: {
                        in: ['USER', 'MODERATOR'],
                    },
                },
            }),
            prismaClient_1.prisma.transparencyLog.aggregate({
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
    async getLogs(page, pageSize, userId) {
        const skip = (page - 1) * pageSize;
        const where = userId ? { userId } : undefined;
        const [items, total] = await Promise.all([
            prismaClient_1.prisma.transparencyLog.findMany({
                where,
                orderBy: { timestamp: 'desc' },
                skip,
                take: pageSize,
            }),
            prismaClient_1.prisma.transparencyLog.count({ where }),
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
exports.TransparencyLedgerService = TransparencyLedgerService;
