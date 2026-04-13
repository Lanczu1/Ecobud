"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LearnService = void 0;
const errorResponder_1 = require("../http/errorResponder");
const prismaClient_1 = require("../prismaClient");
const supabaseRealtimeService_1 = require("./supabaseRealtimeService");
const GamificationService_1 = require("./GamificationService");
const userActivityService_1 = require("./userActivityService");
class LearnService {
    database;
    gamificationService;
    userActivityService;
    constructor(database = prismaClient_1.prisma) {
        this.database = database;
        this.gamificationService = new GamificationService_1.GamificationService(database);
        this.userActivityService = new userActivityService_1.UserActivityService(database);
    }
    async getPublishedLessons(userId) {
        const lessons = await this.database.lesson.findMany({
            where: {
                isPublished: true,
            },
            orderBy: [{ createdAt: 'asc' }, { title: 'asc' }],
            include: {
                progress: {
                    where: { userId },
                    take: 1,
                },
                createdBy: {
                    select: {
                        id: true,
                        name: true,
                        profile: {
                            select: {
                                displayName: true,
                            },
                        },
                    },
                },
            },
        });
        return lessons.map((lesson) => this.toLessonPayload(lesson));
    }
    async markLessonSeen(userId, lessonId) {
        const lesson = await this.database.lesson.findFirst({
            where: {
                id: lessonId,
                isPublished: true,
            },
        });
        if (!lesson) {
            throw new errorResponder_1.HttpError(404, 'Published lesson not found.');
        }
        const existingProgress = await this.database.userLessonProgress.findUnique({
            where: {
                userId_lessonId: { userId, lessonId },
            },
        });
        if (existingProgress?.status === 'completed') {
            return {
                lessonId,
                status: 'completed',
                progress: 100,
            };
        }
        const progress = existingProgress
            ? await this.database.userLessonProgress.update({
                where: {
                    userId_lessonId: { userId, lessonId },
                },
                data: {
                    status: 'seen',
                    progress: 0,
                    completedAt: null,
                },
            })
            : await this.database.userLessonProgress.create({
                data: {
                    userId,
                    lessonId,
                    status: 'seen',
                    progress: 0,
                },
            });
        const result = {
            lessonId,
            status: progress.status,
            progress: progress.progress,
        };
        await this.userActivityService.touchUserActivity(userId);
        await Promise.all([
            supabaseRealtimeService_1.supabaseRealtimeService.publishUserSectionRefresh(userId, 'learn', {
                actorRole: 'user',
                actorUserId: userId,
                entityId: lessonId,
                reason: 'lesson-seen',
            }),
            supabaseRealtimeService_1.supabaseRealtimeService.publishAdminSectionBundle(['dashboard', 'users'], {
                actorRole: 'user',
                actorUserId: userId,
                entityId: userId,
                reason: 'lesson-seen',
            }),
        ]);
        return result;
    }
    async completeLesson(userId, lessonId) {
        const lesson = await this.database.lesson.findFirst({
            where: {
                id: lessonId,
                isPublished: true,
            },
            select: { id: true },
        });
        if (!lesson) {
            throw new errorResponder_1.HttpError(404, 'Published lesson not found.');
        }
        await this.gamificationService.completeLesson(userId, lessonId);
        const progress = await this.database.userLessonProgress.findUnique({
            where: {
                userId_lessonId: { userId, lessonId },
            },
        });
        if (!progress) {
            throw new errorResponder_1.HttpError(404, 'Lesson progress was not found after completion.');
        }
        return {
            lessonId,
            status: progress.status,
            progress: progress.progress,
        };
    }
    toLessonPayload(lesson) {
        const progressRecord = lesson.progress[0];
        const status = this.normalizeStatus(progressRecord?.status);
        return {
            id: lesson.id,
            title: lesson.title,
            description: lesson.description,
            content: lesson.content,
            is_published: lesson.isPublished,
            created_at: lesson.createdAt.toISOString(),
            progress: status === 'completed' ? 100 : 0,
            status,
            author: lesson.createdBy ? {
                id: lesson.createdBy.id,
                name: lesson.createdBy.name,
                displayName: lesson.createdBy.profile?.displayName || lesson.createdBy.name,
            } : null,
        };
    }
    normalizeStatus(status) {
        if (status === 'completed') {
            return 'completed';
        }
        if (status === 'seen') {
            return 'seen';
        }
        return 'not_started';
    }
}
exports.LearnService = LearnService;
