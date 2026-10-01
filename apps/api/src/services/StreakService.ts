import { Prisma, PrismaClient } from '@prisma/client';
import { prisma } from '../prismaClient';
import { HttpError } from '../http/errorResponder';
import { apiCache } from '../lib/cache';
import { STREAK_MILESTONES, streakMonth, streakStatus } from '../utils/streakRules';

export class StreakService {
  constructor(private readonly database: PrismaClient = prisma) {}

  async summary(userId: string, db: Prisma.TransactionClient | PrismaClient = this.database) {
    const user = await db.user.findUnique({ where: { id: userId }, include: { streakMilestones: true } });
    if (!user) throw new HttpError(404, 'User not found.');
    return {
      currentStreak: user.currentStreak,
      lastChallengeAt: user.lastChallengeAt,
      ...streakStatus(user),
      milestones: STREAK_MILESTONES.map(milestone => ({
        ...milestone,
        awarded: user.streakMilestones.some(item => item.challenges === milestone.challenges),
      })),
    };
  }

  async restore(userId: string) {
    const result = await this.database.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM users WHERE id = ${userId} FOR UPDATE`;
      const user = await tx.user.findUnique({ where: { id: userId } });
      if (!user) throw new HttpError(404, 'User not found.');
      const now = new Date();
      const status = streakStatus(user, now);
      if (status.active) return this.summary(userId, tx);
      if (!status.canRestore) throw new HttpError(400, user.currentStreak === 0 ? 'Complete a challenge to start your streak.' : 'You have used all 3 restores this month.');
      await tx.user.update({ where: { id: userId }, data: {
        streakRestoredAt: now,
        streakRestoreMonth: streakMonth(now),
        streakRestoresUsed: 4 - status.restoresRemaining,
      } });
      return this.summary(userId, tx);
    }, { maxWait: 10000, timeout: 30000 });
    apiCache.delete(`user_dashboard_${userId}`);
    return result;
  }
}
