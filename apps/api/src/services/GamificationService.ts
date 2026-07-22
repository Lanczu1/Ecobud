import { Prisma, PrismaClient } from '@prisma/client';
import { prisma } from '../prismaClient';
import { HttpError } from '../http/errorResponder';
import { supabaseRealtimeService } from './supabaseRealtimeService';
import { TransparencyLedgerService } from './TransparencyLedgerService';
import { UserActivityService } from './userActivityService';
import { UserStatsService } from './UserStatsService';

type DatabaseSession = Prisma.TransactionClient | PrismaClient;

interface AwardActionInput {
  actionType: string;
  knowledgePointsAwarded?: number;
  ecoCoinsAwarded?: number;
  metadata?: Record<string, unknown>;
  pointsAwarded: number;
  userId: string;
}

const ledgerService = new TransparencyLedgerService();

export class GamificationService {
  private readonly userStatsService: UserStatsService;
  private readonly userActivityService: UserActivityService;

  constructor(private readonly database: PrismaClient = prisma) {
    this.userStatsService = new UserStatsService(database);
    this.userActivityService = new UserActivityService(database);
  }

  async completeLesson(userId: string, lessonId: string) {
    const result = await this.database.$transaction(async (tx) => {
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
          awardedBadges: [],
          pointsAwarded: 0,
          ecoCoinsAwarded: 0,
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
        ecoCoinsAwarded: 0,
        metadata: {
          lessonId: lesson.id,
          category: lesson.category,
        },
      });
    });

    await this.broadcastUserActivity(userId, ['learn', 'tracker'], {
      actorRole: 'user',
      actorUserId: userId,
      entityId: lessonId,
      reason: 'lesson-completed',
    });

    return result;
  }

  async updateChallengeProgress(userId: string, challengeId: string, progressPercentage: number) {
    const result = await this.database.$transaction(async (tx) => {
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
          status: progressPercentage >= 100 ? 'UNCLAIMED' : 'IN_PROGRESS',
        },
        create: {
          userId,
          challengeId,
          progressPercentage,
          status: progressPercentage >= 100 ? 'UNCLAIMED' : 'IN_PROGRESS',
          expirationDate,
        },
      });

      return {
        alreadyCompleted: false,
        awardedBadges: [],
        pointsAwarded: 0,
        progressPercentage: currentProgress.progressPercentage,
        streak: null,
      };
    });

    await this.broadcastUserActivity(userId, ['challenges', 'tracker'], {
      actorRole: 'user',
      actorUserId: userId,
      entityId: challengeId,
      reason: progressPercentage >= 100 ? 'challenge-unclaimed' : 'challenge-progress-updated',
    });

    return result;
  }

  async claimChallenge(userId: string, challengeId: string) {
    const result = await this.database.$transaction(async (tx) => {
      const challenge = await tx.challenge.findUnique({ where: { id: challengeId } });
      if (!challenge) {
        throw new HttpError(404, 'Challenge not found.');
      }

      const userChallenge = await tx.userChallenge.findUnique({
        where: { userId_challengeId: { userId, challengeId } }
      });

      const submission = await tx.challengeSubmission.findUnique({
        where: { userId_challengeId: { userId, challengeId } }
      });

      if (submission) {
        if (submission.status !== 'approved') {
          throw new HttpError(400, 'Submission is not approved yet.');
        }
      } else {
        if (!userChallenge || userChallenge.status !== 'UNCLAIMED') {
          throw new HttpError(400, 'Challenge is not ready to be claimed.');
        }
      }

      if (userChallenge && userChallenge.status === 'COMPLETED') {
        throw new HttpError(400, 'Reward already claimed.');
      }

      await tx.userChallenge.upsert({
        where: { userId_challengeId: { userId, challengeId } },
        update: { status: 'COMPLETED', completedAt: new Date(), progressPercentage: 100 },
        create: {
          userId,
          challengeId,
          status: 'COMPLETED',
          completedAt: new Date(),
          progressPercentage: 100,
        },
      });

      return this.awardAction(tx, {
        userId,
        actionType: `Challenge completed: ${challenge.title}`,
        pointsAwarded: challenge.expReward,
        ecoCoinsAwarded: challenge.ecoCoinReward,
        metadata: {
          challengeId: challenge.id,
          difficulty: challenge.difficulty,
        },
      });
    });

    await this.broadcastUserActivity(userId, ['challenges', 'tracker'], {
      actorRole: 'user',
      actorUserId: userId,
      entityId: challengeId,
      reason: 'challenge-completed',
    });

    return result;
  }

  async checkInHabit(userId: string, habitId: string, dateKey: string) {
    const result = await this.database.$transaction(async (tx) => {
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

    await this.broadcastUserActivity(userId, ['tracker'], {
      actorRole: 'user',
      actorUserId: userId,
      entityId: habitId,
      reason: 'habit-check-in',
    });

    return result;
  }

  async markEventAttendance(eventId: string, registrationId: string) {
    const result = await this.database.$transaction(async (tx) => {
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

    const userId = 'userId' in result && typeof result.userId === 'string'
      ? result.userId
      : null;

    if (userId) {
      await Promise.all([
        supabaseRealtimeService.publishUserSectionRefresh(userId, 'tracker', {
          actorRole: 'moderator',
          entityId: eventId,
          reason: 'event-attendance-verified',
        }),
        supabaseRealtimeService.publishAdminSectionBundle(['dashboard', 'users'], {
          actorRole: 'moderator',
          entityId: userId,
          reason: 'event-attendance-verified',
        }),
      ]);
    }

    return result;
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

      if (action.ecoCoinsAwarded && action.ecoCoinsAwarded > 0) {
        await tx.userStats.upsert({
          where: { userId: user.id },
          update: { ecoCoins: { increment: action.ecoCoinsAwarded } },
          create: { userId: user.id, ecoCoins: action.ecoCoinsAwarded, currentStreak: nextStreak, knowledgePoints: 0, ecoPoints: 0 },
        });
      }

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
        ecoCoinsAwarded: action.ecoCoinsAwarded ?? 0,
        pointsTotal: updatedUser.points,
        streak: updatedUser.currentStreak,
        userId: updatedUser.id,
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

  private async broadcastUserActivity(
    userId: string,
    sections: Array<'learn' | 'challenges' | 'tracker'>,
    input: {
      actorRole?: 'user' | 'moderator' | 'admin' | 'system';
      actorUserId?: string;
      entityId?: string;
      reason: string;
    },
  ) {
    await this.userActivityService.touchUserActivity(userId);

    await Promise.all([
      supabaseRealtimeService.publishUserSectionBundle(userId, sections, input),
      supabaseRealtimeService.publishAdminSectionBundle(['dashboard', 'users'], {
        actorRole: input.actorRole,
        actorUserId: input.actorUserId,
        entityId: userId,
        reason: input.reason,
      }),
    ]);
  }
}
