"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserStatsService = void 0;
const errorResponder_1 = require("../http/errorResponder");
const prismaClient_1 = require("../prismaClient");
class UserStatsService {
    database;
    constructor(database = prismaClient_1.prisma) {
        this.database = database;
    }
    async getHomeDashboard(userId) {
        const [stats, weeklyGoal] = await Promise.all([
            this.ensureStats(this.database, userId),
            this.ensureWeeklyGoal(this.database, userId),
        ]);
        return {
            streak: stats.currentStreak,
            ecoPoints: stats.ecoPoints,
            weeklyGoal: weeklyGoal.weeklyGoal,
        };
    }
    async resetKnowledgePoints(input) {
        return this.database.$transaction(async (tx) => {
            const resolvedUserId = input.targetUserId && input.targetUserId !== input.requesterUserId
                ? this.assertAdminTarget(input)
                : input.requesterUserId;
            const existingStats = await this.ensureStats(tx, resolvedUserId);
            const updatedStats = await tx.userStats.update({
                where: { userId: resolvedUserId },
                data: { knowledgePoints: 0 },
            });
            return {
                userId: resolvedUserId,
                previousKnowledgePoints: existingStats.knowledgePoints,
                knowledgePoints: updatedStats.knowledgePoints,
            };
        });
    }
    async ensureStats(database, userId) {
        const existingStats = await database.userStats.findUnique({
            where: { userId },
        });
        if (existingStats) {
            return existingStats;
        }
        const user = await database.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                points: true,
                currentStreak: true,
            },
        });
        if (!user) {
            throw new errorResponder_1.HttpError(404, 'User not found.');
        }
        return database.userStats.create({
            data: {
                userId: user.id,
                ecoPoints: user.points,
                currentStreak: user.currentStreak,
                knowledgePoints: 0,
            },
        });
    }
    async ensureWeeklyGoal(database, userId) {
        const existingGoal = await database.userWeeklyGoal.findUnique({
            where: { userId },
        });
        if (existingGoal) {
            return existingGoal;
        }
        const user = await database.user.findUnique({
            where: { id: userId },
            select: { id: true },
        });
        if (!user) {
            throw new errorResponder_1.HttpError(404, 'User not found.');
        }
        return database.userWeeklyGoal.create({
            data: {
                userId: user.id,
                weeklyGoal: 5,
            },
        });
    }
    async syncEcoPointsAndStreak(database, userId, ecoPoints, currentStreak, knowledgePointsIncrement = 0) {
        const existingStats = await this.ensureStats(database, userId);
        return database.userStats.update({
            where: { userId },
            data: {
                ecoPoints,
                currentStreak,
                knowledgePoints: existingStats.knowledgePoints + knowledgePointsIncrement,
            },
        });
    }
    assertAdminTarget(input) {
        if (input.requesterRole !== 'admin') {
            throw new errorResponder_1.HttpError(403, 'Only admins can reset another user\'s knowledge points.');
        }
        return input.targetUserId;
    }
}
exports.UserStatsService = UserStatsService;
