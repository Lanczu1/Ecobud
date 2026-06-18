import { PrismaClient } from '@prisma/client';
import { HttpError } from '../http/errorResponder';
import { prisma } from '../prismaClient';
import { supabaseRealtimeService } from './supabaseRealtimeService';
import { GamificationService } from './GamificationService';
import { UserActivityService } from './userActivityService';

export type LessonStatus = 'not_started' | 'seen' | 'completed';

export interface QuizQuestionPayload {
  id: string;
  question: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correctAnswer: string;
}

export interface LearnLessonPayload {
  id: string;
  title: string;
  description: string;
  content: string;
  category?: string;
  difficulty?: string;
  is_published: boolean;
  created_at: string;
  progress: number;
  videoTimestamp?: number;
  status: LessonStatus;
  imageUrl?: string | null;
  videoUrl?: string | null;
  transcript?: string | null;
  pointsReward?: number;
  author?: {
    id: string;
    name: string;
    displayName: string;
  } | null;
  hasQuiz?: boolean;
  quizQuestions?: QuizQuestionPayload[];
  pages?: {
    id: string;
    title: string;
    description: string;
    content: string;
    order: number;
  }[];
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
        quizQuestions: {
          select: { id: true, question: true, optionA: true, optionB: true, optionC: true, optionD: true, correctAnswer: true },
        },
        pages: {
          orderBy: { order: 'asc' },
          select: { id: true, title: true, description: true, content: true, order: true },
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
      videoTimestamp: progress.videoTimestamp,
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
      videoTimestamp: progress.videoTimestamp,
    };
  }

  async updateLessonProgress(userId: string, lessonId: string, progressValue: number, videoTimestamp: number = 0) {
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
        videoTimestamp: existingProgress.videoTimestamp,
      };
    }

    const clampedProgress = Math.min(100, Math.max(0, Math.round(progressValue)));
    const finalProgress = existingProgress 
      ? Math.max(existingProgress.progress, clampedProgress) 
      : clampedProgress;

    const progress = existingProgress
      ? await this.database.userLessonProgress.update({
        where: {
          userId_lessonId: { userId, lessonId },
        },
        data: {
          progress: finalProgress,
          videoTimestamp: videoTimestamp > 0 ? videoTimestamp : undefined,
        },
      })
      : await this.database.userLessonProgress.create({
        data: {
          userId,
          lessonId,
          status: 'seen',
          progress: clampedProgress,
          videoTimestamp,
        },
      });

    return {
      lessonId,
      status: progress.status as LessonStatus,
      progress: progress.progress,
      videoTimestamp: progress.videoTimestamp,
    };
  }

  private toLessonPayload(lesson: {
    id: string;
    title: string;
    description: string;
    content: string;
    category: string;
    difficulty?: string | null;
    imageUrl: string | null;
    videoUrl: string | null;
    transcript: string | null;
    isPublished: boolean;
    createdAt: Date;
    pointsReward: number;
    progress: Array<{
      status: string;
      progress: number;
      videoTimestamp: number;
    }>;
    quizQuestions?: Array<{ id: string; question: string; optionA: string; optionB: string; optionC: string; optionD: string; correctAnswer: string }>;
    pages?: Array<{ id: string; title: string; description: string; content: string; order: number }>;
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
      category: lesson.category,
      difficulty: lesson.difficulty || undefined,
      is_published: lesson.isPublished,
      created_at: lesson.createdAt.toISOString(),
      progress: status === 'completed' ? 100 : (progressRecord?.progress ?? 0),
      videoTimestamp: progressRecord?.videoTimestamp ?? 0,
      status,
      imageUrl: lesson.imageUrl,
      videoUrl: lesson.videoUrl,
      transcript: lesson.transcript,
      pointsReward: lesson.pointsReward,
      author: lesson.createdBy ? {
        id: lesson.createdBy.id,
        name: lesson.createdBy.name,
        displayName: lesson.createdBy.profile?.displayName || lesson.createdBy.name,
      } : null,
      hasQuiz: lesson.quizQuestions && lesson.quizQuestions.length > 0,
      quizQuestions: lesson.quizQuestions && lesson.quizQuestions.length > 0
        ? lesson.quizQuestions.map((q) => ({
            id: q.id,
            question: q.question,
            optionA: q.optionA,
            optionB: q.optionB,
            optionC: q.optionC,
            optionD: q.optionD,
            correctAnswer: q.correctAnswer,
          }))
        : [],
      pages: lesson.pages && lesson.pages.length > 0 
        ? lesson.pages.map((p) => ({
            id: p.id,
            title: p.title,
            description: p.description,
            content: p.content,
            order: p.order,
          }))
        : [],
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
