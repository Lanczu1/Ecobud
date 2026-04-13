"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GamificationService = void 0;
const prismaClient_1 = require("../prismaClient");
const errorResponder_1 = require("../http/errorResponder");
const supabaseRealtimeService_1 = require("./supabaseRealtimeService");
const TransparencyLedgerService_1 = require("./TransparencyLedgerService");
const userActivityService_1 = require("./userActivityService");
const UserStatsService_1 = require("./UserStatsService");
const ledgerService = new TransparencyLedgerService_1.TransparencyLedgerService();
class GamificationService {
    database;
    userStatsService;
    userActivityService;
    constructor(database = prismaClient_1.prisma) {
        this.database = database;
        this.userStatsService = new UserStatsService_1.UserStatsService(database);
        this.userActivityService = new userActivityService_1.UserActivityService(database);
    }
    async completeLesson(userId, lessonId) {
        const result = await this.database.$transaction(async (tx) => {
            const lesson = await tx.lesson.findUnique({ where: { id: lessonId } });
            if (!lesson) {
                throw new errorResponder_1.HttpError(404, 'Lesson not found.');
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
        await this.broadcastUserActivity(userId, ['learn', 'tracker'], {
            actorRole: 'user',
            actorUserId: userId,
            entityId: lessonId,
            reason: 'lesson-completed',
        });
        return result;
    }
    async updateChallengeProgress(userId, challengeId, progressPercentage) {
        const result = await this.database.$transaction(async (tx) => {
            const challenge = await tx.challenge.findUnique({ where: { id: challengeId } });
            if (!challenge) {
                throw new errorResponder_1.HttpError(404, 'Challenge not found.');
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
        await this.broadcastUserActivity(userId, ['challenges', 'tracker'], {
            actorRole: 'user',
            actorUserId: userId,
            entityId: challengeId,
            reason: progressPercentage >= 100 ? 'challenge-completed' : 'challenge-progress-updated',
        });
        return result;
    }
    async checkInHabit(userId, habitId, dateKey) {
        const result = await this.database.$transaction(async (tx) => {
            const habit = await tx.habit.findUnique({ where: { id: habitId } });
            if (!habit) {
                throw new errorResponder_1.HttpError(404, 'Habit not found.');
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
    async markEventAttendance(eventId, registrationId) {
        const result = await this.database.$transaction(async (tx) => {
            const event = await tx.event.findUnique({
                where: { id: eventId },
            });
            if (!event) {
                throw new errorResponder_1.HttpError(404, 'Event not found.');
            }
            const registration = await tx.eventRegistration.findUnique({
                where: { id: registrationId },
            });
            if (!registration || registration.eventId !== eventId) {
                throw new errorResponder_1.HttpError(404, 'Registration not found.');
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
                supabaseRealtimeService_1.supabaseRealtimeService.publishUserSectionRefresh(userId, 'tracker', {
                    actorRole: 'moderator',
                    entityId: eventId,
                    reason: 'event-attendance-verified',
                }),
                supabaseRealtimeService_1.supabaseRealtimeService.publishAdminSectionBundle(['dashboard', 'users'], {
                    actorRole: 'moderator',
                    entityId: userId,
                    reason: 'event-attendance-verified',
                }),
            ]);
        }
        return result;
    }
    createExpirationDate(durationDays) {
        const expirationDate = new Date();
        expirationDate.setDate(expirationDate.getDate() + durationDays);
        return expirationDate;
    }
    async awardAction(tx, action) {
        const user = await tx.user.findUnique({
            where: { id: action.userId },
        });
        if (!user) {
            throw new errorResponder_1.HttpError(404, 'User not found.');
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
        const updatedStats = await this.userStatsService.syncEcoPointsAndStreak(tx, user.id, updatedUser.points, updatedUser.currentStreak, action.knowledgePointsAwarded ?? 0);
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
            userId: updatedUser.id,
        };
    }
    resolveStreak(lastActionDate, actionDate, currentStreak) {
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
    async unlockBadges(tx, userId, totalPoints) {
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
    async broadcastUserActivity(userId, sections, input) {
        await this.userActivityService.touchUserActivity(userId);
        await Promise.all([
            supabaseRealtimeService_1.supabaseRealtimeService.publishUserSectionBundle(userId, sections, input),
            supabaseRealtimeService_1.supabaseRealtimeService.publishAdminSectionBundle(['dashboard', 'users'], {
                actorRole: input.actorRole,
                actorUserId: input.actorUserId,
                entityId: userId,
                reason: input.reason,
            }),
        ]);
    }
}
exports.GamificationService = GamificationService;
