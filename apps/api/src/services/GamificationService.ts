import { Prisma, PrismaClient } from '@prisma/client';
import { prisma } from '../prismaClient';
import { HttpError } from '../http/errorResponder';
import { TransparencyLedgerService } from './TransparencyLedgerService';
import { UserStatsService } from './UserStatsService';

type DatabaseSession = Prisma.TransactionClient | PrismaClient;

interface AwardActionInput {
  actionType: string;
  knowledgePointsAwarded?: number;
  metadata?: Record<string, unknown>;
  pointsAwarded: number;
  userId: string;
}

const ledgerService = new TransparencyLedgerService();

export class GamificationService {
  private readonly userStatsService: UserStatsService;

  constructor(private readonly database: PrismaClient = prisma) {
    this.userStatsService = new UserStatsService(database);
  }

  async completeLesson(userId: string, lessonId: string) {
    return this.database.$transaction(async (tx) => {
      const lesson = await tx.lesson.findUnique({ where: { id: lessonId } });

      if (!lesson) {
        throw new HttpError(404, 'Lesson not found.');
      }

      const existingProgress = await tx.userLessonProgress.findUnique({
        where: {
          userId_lessonId: { userId, lessonId },
        },
      });

      if (existingProgress?.status === 'completed') {
        return {
          alreadyCompleted: true,
          lessonId,
        };
      }

      await tx.userLessonProgress.upsert({
        where: {
          userId_lessonId: { userId, lessonId },
        },
        update: {
          status: 'completed',
          progress: 100,
          completedAt: new Date(),
        },
        create: {
          userId,
          lessonId,
          status: 'completed',
          progress: 100,
          completedAt: new Date(),
        },
      });

      return this.awardAction(tx, {
        userId,
        actionType: `Lesson completed: ${lesson.title}`,
        knowledgePointsAwarded: lesson.pointsReward,
        pointsAwarded: lesson.pointsReward,
        metadata: {
          lessonId: lesson.id,
          category: lesson.category,
        },
      });
    });
  }

  async updateChallengeProgress(userId: string, challengeId: string, progressPercentage: number) {
    return this.database.$transaction(async (tx) => {
      const challenge = await tx.challenge.findUnique({ where: { id: challengeId } });

      if (!challenge) {
        throw new HttpError(404, 'Challenge not found.');
      }

      const existingProgress = await tx.userChallenge.findUnique({
        where: {
          userId_challengeId: { userId, challengeId },
        },
      });

      if (existingProgress?.status === 'COMPLETED') {
        return {
          alreadyCompleted: true,
          awardedBadges: [],
          pointsAwarded: 0,
          progressPercentage: existingProgress.progressPercentage,
          streak: null,
        };
      }

      const expirationDate = existingProgress?.expirationDate ?? this.createExpirationDate(challenge.durationDays);

      const currentProgress = await tx.userChallenge.upsert({
        where: {
          userId_challengeId: { userId, challengeId },
        },
        update: {
          progressPercentage,
          status: progressPercentage >= 100 ? 'COMPLETED' : 'IN_PROGRESS',
          completedAt: progressPercentage >= 100 ? new Date() : null,
        },
        create: {
          userId,
          challengeId,
          progressPercentage,
          status: progressPercentage >= 100 ? 'COMPLETED' : 'IN_PROGRESS',
          completedAt: progressPercentage >= 100 ? new Date() : null,
          expirationDate,
        },
      });

      if (currentProgress.status !== 'COMPLETED' || progressPercentage < 100) {
        return {
          alreadyCompleted: false,
          awardedBadges: [],
          pointsAwarded: 0,
          progressPercentage: currentProgress.progressPercentage,
          streak: null,
        };
      }

      return this.awardAction(tx, {
        userId,
        actionType: `Challenge completed: ${challenge.title}`,
        pointsAwarded: challenge.pointsReward,
        metadata: {
          challengeId: challenge.id,
          difficulty: challenge.difficulty,
        },
      });
    });
  }

  async checkInHabit(userId: string, habitId: string, dateKey: string) {
    return this.database.$transaction(async (tx) => {
      const habit = await tx.habit.findUnique({ where: { id: habitId } });

      if (!habit) {
        throw new HttpError(404, 'Habit not found.');
      }

      const existingCheckIn = await tx.habitCheckIn.findUnique({
        where: {
          userId_habitId_dateKey: {
            userId,
            habitId,
            dateKey,
          },
        },
      });

      if (existingCheckIn) {
        return {
          alreadyCompleted: true,
          pointsAwarded: 0,
          awardedBadges: [],
        };
      }

      await tx.habitCheckIn.create({
        data: {
          userId,
          habitId,
          dateKey,
          pointsAwarded: habit.pointsReward,
        },
      });

      return this.awardAction(tx, {
        userId,
        actionType: `Daily habit completed: ${habit.title}`,
        pointsAwarded: habit.pointsReward,
        metadata: {
          habitId: habit.id,
          dateKey,
        },
      });
    });
  }

  async markEventAttendance(eventId: string, registrationId: string) {
    return this.database.$transaction(async (tx) => {
      const event = await tx.event.findUnique({
        where: { id: eventId },
      });

      if (!event) {
        throw new HttpError(404, 'Event not found.');
      }

      const registration = await tx.eventRegistration.findUnique({
        where: { id: registrationId },
      });

      if (!registration || registration.eventId !== eventId) {
        throw new HttpError(404, 'Registration not found.');
      }

      if (registration.status === 'ATTENDED') {
        return {
          alreadyCompleted: true,
          pointsAwarded: 0,
          awardedBadges: [],
        };
      }

      await tx.eventRegistration.update({
        where: { id: registrationId },
        data: {
          status: 'ATTENDED',
          attendedAt: new Date(),
        },
      });

      return this.awardAction(tx, {
        userId: registration.userId,
        actionType: `Event attended: ${event.title}`,
        pointsAwarded: event.pointsReward,
        metadata: {
          eventId: event.id,
          location: event.location,
        },
      });
    });
  }

  private createExpirationDate(durationDays: number) {
    const expirationDate = new Date();
    expirationDate.setDate(expirationDate.getDate() + durationDays);
    return expirationDate;
  }

  private async awardAction(tx: DatabaseSession, action: AwardActionInput) {
    const user = await tx.user.findUnique({
      where: { id: action.userId },
    });

    if (!user) {
      throw new HttpError(404, 'User not found.');
    }

    const now = new Date();
    const nextStreak = this.resolveStreak(user.lastActionDate, now, user.currentStreak);

      const updatedUser = await tx.user.update({
        where: { id: user.id },
        data: {
          points: { increment: action.pointsAwarded },
          currentStreak: nextStreak,
          lastActionDate: now,
        },
      });

      const updatedStats = await this.userStatsService.syncEcoPointsAndStreak(
        tx,
        user.id,
        updatedUser.points,
        updatedUser.currentStreak,
        action.knowledgePointsAwarded ?? 0,
      );

      const awardedBadges = await this.unlockBadges(tx, user.id, updatedUser.points);
      const log = await ledgerService.appendLog(tx, action);

      return {
        alreadyCompleted: false,
        awardedBadges,
        currentHash: log.currentHash,
        knowledgePointsTotal: updatedStats.knowledgePoints,
        pointsAwarded: action.pointsAwarded,
        pointsTotal: updatedUser.points,
        streak: updatedUser.currentStreak,
      };
  }

  private resolveStreak(
    lastActionDate: Date | null,
    actionDate: Date,
    currentStreak: number,
  ) {
    if (!lastActionDate) {
      return 1;
    }

    const actionDay = actionDate.toISOString().slice(0, 10);
    const lastDay = lastActionDate.toISOString().slice(0, 10);

    if (actionDay === lastDay) {
      return currentStreak;
    }

    const previousDate = new Date(actionDate);
    previousDate.setDate(previousDate.getDate() - 1);
    const previousDay = previousDate.toISOString().slice(0, 10);

    if (lastDay === previousDay) {
      return currentStreak + 1;
    }

    return 1;
  }

  private async unlockBadges(tx: DatabaseSession, userId: string, totalPoints: number) {
    const [existingBadges, matchingBadges] = await Promise.all([
      tx.userBadge.findMany({
        where: { userId },
        select: { badgeId: true },
      }),
      tx.badge.findMany({
        where: {
          requiredPoints: { lte: totalPoints },
        },
        orderBy: { requiredPoints: 'asc' },
      }),
    ]);

    const ownedBadgeIds = new Set(existingBadges.map((item) => item.badgeId));
    const newBadges = matchingBadges.filter((item) => !ownedBadgeIds.has(item.id));

    if (newBadges.length === 0) {
      return [];
    }

    await tx.userBadge.createMany({
      data: newBadges.map((badge) => ({
        userId,
        badgeId: badge.id,
      })),
    });

    return newBadges;
  }
}
