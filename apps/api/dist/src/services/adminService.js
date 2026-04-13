"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminService = void 0;
const prismaClient_1 = require("../prismaClient");
const supabaseRealtimeService_1 = require("./supabaseRealtimeService");
const userActivityService_1 = require("./userActivityService");
class AdminService {
    static async getAllLessons() {
        return await prismaClient_1.prisma.lesson.findMany({
            orderBy: { createdAt: 'desc' },
            include: {
                createdBy: {
                    select: {
                        id: true,
                        name: true,
                        email: true
                    }
                }
            }
        });
    }
    static async createLesson(data) {
        const lesson = await prismaClient_1.prisma.lesson.create({
            data: {
                title: data.title,
                description: data.description,
                content: data.content,
                isPublished: data.isPublished,
                createdById: data.createdById,
                category: data.category || "General"
            }
        });
        if (lesson.isPublished) {
            await Promise.all([
                supabaseRealtimeService_1.supabaseRealtimeService.publishGlobalSectionRefresh('learn', {
                    actorRole: 'admin',
                    actorUserId: data.createdById,
                    entityId: lesson.id,
                    reason: 'lesson-created',
                }),
                supabaseRealtimeService_1.supabaseRealtimeService.publishAdminSectionRefresh('dashboard', {
                    actorRole: 'admin',
                    actorUserId: data.createdById,
                    entityId: lesson.id,
                    reason: 'lesson-created',
                }),
            ]);
        }
        else {
            await supabaseRealtimeService_1.supabaseRealtimeService.publishAdminSectionRefresh('dashboard', {
                actorRole: 'admin',
                actorUserId: data.createdById,
                entityId: lesson.id,
                reason: 'lesson-created',
            });
        }
        return lesson;
    }
    static async updateLesson(id, data) {
        const lesson = await prismaClient_1.prisma.lesson.update({
            where: { id },
            data
        });
        await Promise.all([
            supabaseRealtimeService_1.supabaseRealtimeService.publishGlobalSectionRefresh('learn', {
                actorRole: 'admin',
                entityId: id,
                reason: 'lesson-updated',
            }),
            supabaseRealtimeService_1.supabaseRealtimeService.publishAdminSectionRefresh('dashboard', {
                actorRole: 'admin',
                entityId: id,
                reason: 'lesson-updated',
            }),
        ]);
        return lesson;
    }
    static async deleteLesson(id) {
        const lesson = await prismaClient_1.prisma.lesson.delete({
            where: { id }
        });
        await Promise.all([
            supabaseRealtimeService_1.supabaseRealtimeService.publishGlobalSectionRefresh('learn', {
                actorRole: 'admin',
                entityId: id,
                reason: 'lesson-deleted',
            }),
            supabaseRealtimeService_1.supabaseRealtimeService.publishAdminSectionRefresh('dashboard', {
                actorRole: 'admin',
                entityId: id,
                reason: 'lesson-deleted',
            }),
        ]);
        return lesson;
    }
    static async togglePublish(id, isPublished) {
        const lesson = await prismaClient_1.prisma.lesson.update({
            where: { id },
            data: { isPublished }
        });
        await Promise.all([
            supabaseRealtimeService_1.supabaseRealtimeService.publishGlobalSectionRefresh('learn', {
                actorRole: 'admin',
                entityId: id,
                reason: isPublished ? 'lesson-published' : 'lesson-unpublished',
            }),
            supabaseRealtimeService_1.supabaseRealtimeService.publishAdminSectionRefresh('dashboard', {
                actorRole: 'admin',
                entityId: id,
                reason: isPublished ? 'lesson-published' : 'lesson-unpublished',
            }),
        ]);
        return lesson;
    }
    static async resetUserKnowledge(userId) {
        return await prismaClient_1.prisma.userStats.update({
            where: { userId },
            data: { knowledgePoints: 0 }
        });
    }
    static async getUsers() {
        const users = await prismaClient_1.prisma.user.findMany({
            orderBy: { createdAt: 'desc' },
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
                        avatarUrl: true
                    }
                }
            }
        });
        const now = new Date();
        return users.map((user) => ({
            ...user,
            createdAt: user.createdAt.toISOString(),
            isOnlineNow: (0, userActivityService_1.isUserCurrentlyOnline)(user.lastActionDate, now),
            lastActionDate: user.lastActionDate?.toISOString() ?? null,
        }));
    }
    // Challenge Management
    static async getAllChallenges() {
        return await prismaClient_1.prisma.challenge.findMany({
            orderBy: { createdAt: 'desc' }
        });
    }
    static async createChallenge(data) {
        const challenge = await prismaClient_1.prisma.challenge.create({
            data: {
                title: data.title,
                description: data.description,
                difficulty: data.difficulty,
                durationDays: data.durationDays,
                pointsReward: data.pointsReward,
                category: data.category || "General",
                active: data.active ?? true,
                imageUrl: data.imageUrl,
                badgeLabel: data.badgeLabel
            }
        });
        await Promise.all([
            supabaseRealtimeService_1.supabaseRealtimeService.publishGlobalSectionRefresh('challenges', {
                actorRole: 'admin',
                entityId: challenge.id,
                reason: 'challenge-created',
            }),
            supabaseRealtimeService_1.supabaseRealtimeService.publishAdminSectionRefresh('dashboard', {
                actorRole: 'admin',
                entityId: challenge.id,
                reason: 'challenge-created',
            }),
        ]);
        return challenge;
    }
    static async updateChallenge(id, data) {
        const challenge = await prismaClient_1.prisma.challenge.update({
            where: { id },
            data
        });
        await Promise.all([
            supabaseRealtimeService_1.supabaseRealtimeService.publishGlobalSectionRefresh('challenges', {
                actorRole: 'admin',
                entityId: id,
                reason: 'challenge-updated',
            }),
            supabaseRealtimeService_1.supabaseRealtimeService.publishAdminSectionRefresh('dashboard', {
                actorRole: 'admin',
                entityId: id,
                reason: 'challenge-updated',
            }),
        ]);
        return challenge;
    }
    static async deleteChallenge(id) {
        const challenge = await prismaClient_1.prisma.challenge.delete({
            where: { id }
        });
        await Promise.all([
            supabaseRealtimeService_1.supabaseRealtimeService.publishGlobalSectionRefresh('challenges', {
                actorRole: 'admin',
                entityId: id,
                reason: 'challenge-deleted',
            }),
            supabaseRealtimeService_1.supabaseRealtimeService.publishAdminSectionRefresh('dashboard', {
                actorRole: 'admin',
                entityId: id,
                reason: 'challenge-deleted',
            }),
        ]);
        return challenge;
    }
    static async getDashboardStats() {
        const snapshotDate = new Date();
        const startOfToday = new Date(snapshotDate);
        startOfToday.setHours(0, 0, 0, 0);
        const endOfToday = new Date(snapshotDate);
        endOfToday.setHours(23, 59, 59, 999);
        const userActivityService = new userActivityService_1.UserActivityService();
        const onlineThreshold = userActivityService.getOnlineThreshold(snapshotDate);
        const [totalUsers, activeToday, onlineNow, signupsToday, totalLessons, totalChallenges, userPoints, lessonCompletions,] = await Promise.all([
            prismaClient_1.prisma.user.count(),
            prismaClient_1.prisma.user.count({
                where: {
                    lastActionDate: {
                        gte: startOfToday,
                        lte: endOfToday,
                    },
                },
            }),
            prismaClient_1.prisma.user.count({
                where: {
                    lastActionDate: {
                        gte: onlineThreshold,
                    },
                },
            }),
            prismaClient_1.prisma.user.count({
                where: {
                    createdAt: {
                        gte: startOfToday,
                        lte: endOfToday,
                    },
                },
            }),
            prismaClient_1.prisma.lesson.count(),
            prismaClient_1.prisma.challenge.count(),
            prismaClient_1.prisma.user.aggregate({
                _sum: {
                    points: true,
                },
            }),
            prismaClient_1.prisma.userLessonProgress.count({
                where: { status: 'completed' },
            }),
        ]);
        const activityTrend = await Promise.all([...Array(7)].map(async (_, i) => {
            const date = new Date(snapshotDate);
            date.setDate(snapshotDate.getDate() - (6 - i));
            const startOfDay = new Date(date);
            startOfDay.setHours(0, 0, 0, 0);
            const endOfDay = new Date(date);
            endOfDay.setHours(23, 59, 59, 999);
            const [active, signups] = await Promise.all([
                prismaClient_1.prisma.user.count({
                    where: {
                        lastActionDate: {
                            gte: startOfDay,
                            lte: endOfDay,
                        },
                    },
                }),
                prismaClient_1.prisma.user.count({
                    where: {
                        createdAt: {
                            gte: startOfDay,
                            lte: endOfDay,
                        },
                    },
                }),
            ]);
            return {
                active,
                date: startOfDay.toISOString(),
                dateLabel: startOfDay.toLocaleDateString('en-US', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                }),
                day: startOfDay.toLocaleDateString('en-US', { weekday: 'short' }),
                signups,
            };
        }));
        return {
            overview: {
                activeToday,
                lessonCompletions,
                onlineNow,
                onlineWindowMinutes: userActivityService_1.ONLINE_ACTIVITY_WINDOW_MS / 60000,
                signupsToday,
                snapshotDate: snapshotDate.toISOString(),
                totalChallenges,
                totalLessons,
                totalPoints: userPoints._sum.points || 0,
                totalUsers,
                totalSignups: totalUsers,
            },
            activityTrend,
        };
    }
    static async getSubmissions() {
        return await prismaClient_1.prisma.challengeSubmission.findMany({
            orderBy: { createdAt: 'desc' },
            include: {
                user: {
                    select: {
                        id: true,
                        name: true,
                        profile: true
                    }
                },
                challenge: true
            }
        });
    }
    static async reviewSubmission(id, reviewerId, status, notes) {
        const submission = await prismaClient_1.prisma.challengeSubmission.update({
            where: { id },
            data: {
                status,
                moderatorNotes: notes,
                reviewedById: reviewerId,
                reviewedAt: new Date()
            },
            include: {
                challenge: true,
                user: true
            }
        });
        if (status === 'approved') {
            // Award points
            await prismaClient_1.prisma.user.update({
                where: { id: submission.userId },
                data: {
                    points: { increment: submission.challenge.pointsReward }
                }
            });
            // Recalculate streak or other gamification
        }
        // Create Audit Log
        await prismaClient_1.prisma.auditLog.create({
            data: {
                action: `SUBMISSION_${status.toUpperCase()}`,
                userId: submission.userId,
                details: JSON.stringify({
                    challengeId: submission.challengeId,
                    challengeTitle: submission.challenge.title,
                    reviewerId,
                    notes
                }),
                timestamp: new Date()
            }
        });
        await supabaseRealtimeService_1.supabaseRealtimeService.publishUserSectionBundle(submission.userId, ['challenges', 'tracker'], {
            actorRole: 'admin',
            actorUserId: reviewerId,
            entityId: submission.challengeId,
            reason: `submission-${status}`,
        });
        await supabaseRealtimeService_1.supabaseRealtimeService.publishUserNotice(submission.userId, {
            level: status === 'approved' ? 'success' : 'warning',
            message: status === 'approved'
                ? `Your proof for "${submission.challenge.title}" has been approved.`
                : `Your proof for "${submission.challenge.title}" was rejected.${notes ? ` Notes: ${notes}` : ''}`,
            scope: 'moderation',
            title: status === 'approved' ? 'Challenge approved' : 'Challenge review update',
        });
        await supabaseRealtimeService_1.supabaseRealtimeService.publishAdminSectionBundle(['dashboard', 'users'], {
            actorRole: 'admin',
            actorUserId: reviewerId,
            entityId: submission.userId,
            reason: `submission-${status}`,
        });
        return submission;
    }
    static async getAuditLogs() {
        return await prismaClient_1.prisma.auditLog.findMany({
            orderBy: { timestamp: 'desc' },
            include: {
                user: {
                    select: {
                        name: true,
                        email: true
                    }
                }
            },
            take: 50
        });
    }
}
exports.AdminService = AdminService;
