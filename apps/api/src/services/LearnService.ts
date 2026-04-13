import { PrismaClient } from '@prisma/client';
import { HttpError } from '../http/errorResponder';
import { prisma } from '../prismaClient';
import { supabaseRealtimeService } from './supabaseRealtimeService';
import { GamificationService } from './GamificationService';
import { UserActivityService } from './userActivityService';

export type LessonStatus = 'not_started' | 'seen' | 'completed';

export interface LearnLessonPayload {
  id: string;
  title: string;
  description: string;
  content: string;
  is_published: boolean;
  created_at: string;
  progress: number;
  status: LessonStatus;
  author?: {
    id: string;
    name: string;
    displayName: string;
  } | null;
}

export class LearnService {
  private readonly gamificationService: GamificationService;
  private readonly userActivityService: UserActivityService;

  constructor(private readonly database: PrismaClient = prisma) {
    this.gamificationService = new GamificationService(database);
    this.userActivityService = new UserActivityService(database);
  }

  async getPublishedLessons(userId: string): Promise<LearnLessonPayload[]> {
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

  async markLessonSeen(userId: string, lessonId: string) {
    const lesson = await this.database.lesson.findFirst({
      where: {
        id: lessonId,
        isPublished: true,
      },
    });

    if (!lesson) {
      throw new HttpError(404, 'Published lesson not found.');
    }

    const existingProgress = await this.database.userLessonProgress.findUnique({
      where: {
        userId_lessonId: { userId, lessonId },
      },
    });

    if (existingProgress?.status === 'completed') {
      return {
        lessonId,
        status: 'completed' as LessonStatus,
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
      status: progress.status as LessonStatus,
      progress: progress.progress,
    };

    await this.userActivityService.touchUserActivity(userId);
    await Promise.all([
      supabaseRealtimeService.publishUserSectionRefresh(userId, 'learn', {
        actorRole: 'user',
        actorUserId: userId,
        entityId: lessonId,
        reason: 'lesson-seen',
      }),
      supabaseRealtimeService.publishAdminSectionBundle(['dashboard', 'users'], {
        actorRole: 'user',
        actorUserId: userId,
        entityId: userId,
        reason: 'lesson-seen',
      }),
    ]);

    return result;
  }

  async completeLesson(userId: string, lessonId: string) {
    const lesson = await this.database.lesson.findFirst({
      where: {
        id: lessonId,
        isPublished: true,
      },
      select: { id: true },
    });

    if (!lesson) {
      throw new HttpError(404, 'Published lesson not found.');
    }

    await this.gamificationService.completeLesson(userId, lessonId);

    const progress = await this.database.userLessonProgress.findUnique({
      where: {
        userId_lessonId: { userId, lessonId },
      },
    });

    if (!progress) {
      throw new HttpError(404, 'Lesson progress was not found after completion.');
    }

    return {
      lessonId,
      status: progress.status as LessonStatus,
      progress: progress.progress,
    };
  }

  private toLessonPayload(lesson: {
    id: string;
    title: string;
    description: string;
    content: string;
    isPublished: boolean;
    createdAt: Date;
    progress: Array<{
      status: string;
      progress: number;
    }>;
    createdBy?: {
      id: string;
      name: string;
      profile: {
        displayName: string;
      } | null;
    } | null;
  }): LearnLessonPayload {
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

  private normalizeStatus(status?: string): LessonStatus {
    if (status === 'completed') {
      return 'completed';
    }

    if (status === 'seen') {
      return 'seen';
    }

    return 'not_started';
  }
}
