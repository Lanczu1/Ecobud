import { Prisma, PrismaClient } from '@prisma/client';
import { HttpError } from '../http/errorResponder';
import { prisma } from '../prismaClient';

type DatabaseSession = Prisma.TransactionClient | PrismaClient;

export interface HomeDashboardPayload {
  streak: number;
  ecoPoints: number;
  ecoCoins: number;
  weeklyGoal: number;
}

interface ResetKnowledgeInput {
  requesterRole: 'user' | 'moderator' | 'admin';
  requesterUserId: string;
  targetUserId?: string;
}

export class UserStatsService {
  constructor(private readonly database: PrismaClient = prisma) {}

  async getHomeDashboard(userId: string): Promise<HomeDashboardPayload> {
    const [stats, weeklyGoal] = await Promise.all([
      this.ensureStats(this.database, userId),
      this.ensureWeeklyGoal(this.database, userId),
    ]);

    return {
      streak: stats.currentStreak,
      ecoPoints: stats.ecoPoints,
      ecoCoins: stats.ecoCoins,
      weeklyGoal: weeklyGoal.weeklyGoal,
    };
  }

  async resetKnowledgePoints(input: ResetKnowledgeInput) {
    return this.database.$transaction(async (tx) => {
      const resolvedUserId =
        input.targetUserId && input.targetUserId !== input.requesterUserId
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

  async ensureStats(database: DatabaseSession, userId: string) {
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
      throw new HttpError(404, 'User not found.');
    }

    return database.userStats.create({
      data: {
        userId: user.id,
        ecoPoints: user.points,
        ecoCoins: 0,
        currentStreak: user.currentStreak,
        knowledgePoints: 0,
      },
    });
  }

  async ensureWeeklyGoal(database: DatabaseSession, userId: string) {
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
      throw new HttpError(404, 'User not found.');
    }

    return database.userWeeklyGoal.create({
      data: {
        userId: user.id,
        weeklyGoal: 5,
      },
    });
  }

  async syncEcoPointsAndStreak(
    database: DatabaseSession,
    userId: string,
    ecoPoints: number,
    currentStreak: number,
    knowledgePointsIncrement = 0,
  ) {
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

  private assertAdminTarget(input: ResetKnowledgeInput) {
    if (input.requesterRole !== 'admin') {
      throw new HttpError(403, 'Only admins can reset another user\'s knowledge points.');
    }

    return input.targetUserId!;
  }
}
