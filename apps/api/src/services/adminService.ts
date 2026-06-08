import { prisma } from "../prismaClient";
import { presenceQueryService } from './presenceQueryService';
import { PRESENCE_STALE_TTL_MS } from './presenceService';
import { supabaseRealtimeService } from './supabaseRealtimeService';

export class AdminService {
  static async getAllLessons() {
    return await prisma.lesson.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        quizQuestions: true
      }
    });
  }

  static async createLesson(data: {
    title: string;
    description: string;
    content: string;
    isPublished: boolean;
    createdById: string;
    category: string;
    videoUrl?: string | null;
    imageUrl?: string | null;
    transcript?: string | null;
    durationMinutes?: number;
    quizPassingScore?: number;
    quizQuestions?: any[];
  }) {
    const lesson = await prisma.lesson.create({
      data: {
        title: data.title,
        description: data.description,
        content: data.content,
        isPublished: data.isPublished,
        createdById: data.createdById,
        category: data.category || "General",
        videoUrl: data.videoUrl,
        imageUrl: data.imageUrl,
        transcript: data.transcript,
        durationMinutes: data.durationMinutes ?? 8,
        quizPassingScore: data.quizPassingScore ?? 70,
        quizQuestions: data.quizQuestions?.length ? {
          create: data.quizQuestions.map((q: any) => ({
            question: q.question,
            optionA: q.optionA,
            optionB: q.optionB,
            optionC: q.optionC,
            optionD: q.optionD,
            correctAnswer: q.correctAnswer
          }))
        } : undefined
      }
    });

    if (lesson.isPublished) {
      await Promise.all([
        supabaseRealtimeService.publishGlobalSectionRefresh('learn', {
          actorRole: 'admin',
          actorUserId: data.createdById,
          entityId: lesson.id,
          reason: 'lesson-created',
        }),
        supabaseRealtimeService.publishAdminSectionRefresh('dashboard', {
          actorRole: 'admin',
          actorUserId: data.createdById,
          entityId: lesson.id,
          reason: 'lesson-created',
        }),
      ]);
    } else {
      await supabaseRealtimeService.publishAdminSectionRefresh('dashboard', {
        actorRole: 'admin',
        actorUserId: data.createdById,
        entityId: lesson.id,
        reason: 'lesson-created',
      });
    }

    return lesson;
  }

  static async updateLesson(id: string, data: any) {
    const { quizQuestions, ...otherData } = data;
    
    // If quiz questions are provided, we delete existing and recreate
    let updatePayload: any = { ...otherData };

    if ('pointsReward' in updatePayload && typeof updatePayload.pointsReward === 'string') {
      updatePayload.pointsReward = parseInt(updatePayload.pointsReward, 10);
    }
    
    if ('quizPassingScore' in updatePayload && typeof updatePayload.quizPassingScore === 'string') {
      updatePayload.quizPassingScore = parseInt(updatePayload.quizPassingScore, 10);
    }
    
    if ('durationMinutes' in updatePayload && typeof updatePayload.durationMinutes === 'string') {
      updatePayload.durationMinutes = parseInt(updatePayload.durationMinutes, 10);
    }
    if (quizQuestions) {
      updatePayload.quizQuestions = {
        deleteMany: {},
        create: quizQuestions.map((q: any) => ({
          question: q.question,
          optionA: q.optionA,
          optionB: q.optionB,
          optionC: q.optionC,
          optionD: q.optionD,
          correctAnswer: q.correctAnswer
        }))
      };
    }

    const lesson = await prisma.lesson.update({
      where: { id },
      data: updatePayload
    });

    await Promise.all([
      supabaseRealtimeService.publishGlobalSectionRefresh('learn', {
        actorRole: 'admin',
        entityId: id,
        reason: 'lesson-updated',
      }),
      supabaseRealtimeService.publishAdminSectionRefresh('dashboard', {
        actorRole: 'admin',
        entityId: id,
        reason: 'lesson-updated',
      }),
    ]);

    return lesson;
  }

  static async deleteLesson(id: string) {
    const lesson = await prisma.lesson.delete({
      where: { id }
    });

    await Promise.all([
      supabaseRealtimeService.publishGlobalSectionRefresh('learn', {
        actorRole: 'admin',
        entityId: id,
        reason: 'lesson-deleted',
      }),
      supabaseRealtimeService.publishAdminSectionRefresh('dashboard', {
        actorRole: 'admin',
        entityId: id,
        reason: 'lesson-deleted',
      }),
    ]);

    return lesson;
  }

  static async togglePublish(id: string, isPublished: boolean) {
    const lesson = await prisma.lesson.update({
      where: { id },
      data: { isPublished }
    });

    await Promise.all([
      supabaseRealtimeService.publishGlobalSectionRefresh('learn', {
        actorRole: 'admin',
        entityId: id,
        reason: isPublished ? 'lesson-published' : 'lesson-unpublished',
      }),
      supabaseRealtimeService.publishAdminSectionRefresh('dashboard', {
        actorRole: 'admin',
        entityId: id,
        reason: isPublished ? 'lesson-published' : 'lesson-unpublished',
      }),
    ]);

    return lesson;
  }

  static async resetUserKnowledge(userId: string) {
    return await prisma.userStats.update({
      where: { userId },
      data: { knowledgePoints: 0 }
    });
  }

  static async getUsers() {
    return presenceQueryService.getAdminUsers();
  }

  // Challenge Management
  static async getAllChallenges() {
    return await prisma.challenge.findMany({
      orderBy: { createdAt: 'desc' }
    });
  }

  static async createChallenge(data: {
    title: string;
    description: string;
    difficulty: string;
    durationDays: number;
    expReward: number;
    ecoCoinReward?: number;
    category?: string;
    active?: boolean;
    imageUrl?: string;
    badgeLabel?: string;
    type?: string;
    aiDetectionTargets?: string[];
    aiMinimumConfidence?: number;
  }) {
    const challenge = await prisma.challenge.create({
      data: {
        title: data.title,
        description: data.description,
        difficulty: data.difficulty,
        durationDays: data.durationDays,
        expReward: data.expReward,
        ecoCoinReward: data.ecoCoinReward || 0,
        category: data.category || "General",
        active: data.active ?? true,
        imageUrl: data.imageUrl,
        badgeLabel: data.badgeLabel,
        type: data.type || "GENERAL",
        aiDetectionTargets: data.aiDetectionTargets || [],
        aiMinimumConfidence: data.aiMinimumConfidence || 80
      }
    });

    await Promise.all([
      supabaseRealtimeService.publishGlobalSectionRefresh('challenges', {
        actorRole: 'admin',
        entityId: challenge.id,
        reason: 'challenge-created',
      }),
      supabaseRealtimeService.publishAdminSectionRefresh('dashboard', {
        actorRole: 'admin',
        entityId: challenge.id,
        reason: 'challenge-created',
      }),
    ]);

    return challenge;
  }

  static async updateChallenge(id: string, data: any) {
    const challenge = await prisma.challenge.update({
      where: { id },
      data
    });

    await Promise.all([
      supabaseRealtimeService.publishGlobalSectionRefresh('challenges', {
        actorRole: 'admin',
        entityId: id,
        reason: 'challenge-updated',
      }),
      supabaseRealtimeService.publishAdminSectionRefresh('dashboard', {
        actorRole: 'admin',
        entityId: id,
        reason: 'challenge-updated',
      }),
    ]);

    return challenge;
  }

  static async deleteChallenge(id: string) {
    const challenge = await prisma.challenge.delete({
      where: { id }
    });

    await Promise.all([
      supabaseRealtimeService.publishGlobalSectionRefresh('challenges', {
        actorRole: 'admin',
        entityId: id,
        reason: 'challenge-deleted',
      }),
      supabaseRealtimeService.publishAdminSectionRefresh('dashboard', {
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
    const presenceOverview = await presenceQueryService.getPresenceOverview(snapshotDate);

    const [
      totalUsers,
      signupsToday,
      totalLessons,
      totalChallenges,
      userPoints,
      lessonCompletions,
      pendingSubmissions,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({
        where: {
          createdAt: {
            gte: startOfToday,
            lte: endOfToday,
          },
        },
      }),
      prisma.lesson.count(),
      prisma.challenge.count(),
      prisma.user.aggregate({
        _sum: {
          points: true,
        },
      }),
      prisma.userLessonProgress.count({
        where: { status: 'completed' },
      }),
      prisma.challengeSubmission.count({
        where: { status: 'pending' },
      }),
    ]);

    const activityTrend = await Promise.all(
      [...Array(7)].map(async (_, i) => {
        const date = new Date(snapshotDate);
        date.setDate(snapshotDate.getDate() - (6 - i));

        const startOfDay = new Date(date);
        startOfDay.setHours(0, 0, 0, 0);

        const endOfDay = new Date(date);
        endOfDay.setHours(23, 59, 59, 999);

        const [active, signups] = await Promise.all([
          prisma.user.count({
            where: {
              lastActionDate: {
                gte: startOfDay,
                lte: endOfDay,
              },
            },
          }),
          prisma.user.count({
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
      }),
    );

    return {
      overview: {
        activeToday: presenceOverview.activeToday,
        lessonCompletions,
        onlineNow: presenceOverview.activeToday,
        onlineWindowMinutes: PRESENCE_STALE_TTL_MS / 60000,
        signupsToday,
        snapshotDate: snapshotDate.toISOString(),
        totalChallenges,
        totalLessons,
        totalPoints: userPoints._sum.points || 0,
        totalUsers,
        totalSignups: totalUsers,
      },
      presence: presenceOverview,
      activityTrend,
    };
  }

  static async getSubmissions() {
    return await prisma.challengeSubmission.findMany({
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

  static async reviewSubmission(id: string, reviewerId: string, status: 'approved' | 'rejected', notes?: string) {
    const submission = await prisma.challengeSubmission.update({
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
      await prisma.user.update({
        where: { id: submission.userId },
        data: {
          points: { increment: submission.challenge.expReward }
        }
      });

      if (submission.challenge.ecoCoinReward > 0) {
        await prisma.userStats.upsert({
          where: { userId: submission.userId },
          update: { ecoPoints: { increment: submission.challenge.ecoCoinReward } },
          create: { userId: submission.userId, ecoPoints: submission.challenge.ecoCoinReward }
        });
      }

      // Recalculate streak or other gamification
    }

    // Create Audit Log
    await prisma.auditLog.create({
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

    await supabaseRealtimeService.publishUserSectionBundle(
      submission.userId,
      ['challenges', 'tracker'],
      {
        actorRole: 'admin',
        actorUserId: reviewerId,
        entityId: submission.challengeId,
        reason: `submission-${status}`,
      },
    );

    await supabaseRealtimeService.publishUserNotice(submission.userId, {
      level: status === 'approved' ? 'success' : 'warning',
      message:
        status === 'approved'
          ? `Your proof for "${submission.challenge.title}" has been approved.`
          : `Your proof for "${submission.challenge.title}" was rejected.${notes ? ` Notes: ${notes}` : ''}`,
      scope: 'moderation',
      title: status === 'approved' ? 'Challenge approved' : 'Challenge review update',
    });

    await supabaseRealtimeService.publishAdminSectionBundle(['dashboard', 'users'], {
      actorRole: 'admin',
      actorUserId: reviewerId,
      entityId: submission.userId,
      reason: `submission-${status}`,
    });

    return submission;
  }

  static async getAuditLogs() {
    return await prisma.auditLog.findMany({
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

  // Event Management
  static async getAllEvents() {
    return await prisma.event.findMany({
      orderBy: { date: 'asc' },
      include: {
        registrations: {
          select: { id: true }
        },
        managedBy: {
          select: { id: true, name: true, email: true }
        }
      }
    });
  }

  static async createEvent(data: {
    title: string;
    description: string;
    location: string;
    date: string;
    capacity: number;
    pointsReward: number;
    imageUrl?: string;
    latitude?: number;
    longitude?: number;
    managedById: string;
  }) {
    return await prisma.event.create({
      data: {
        title: data.title,
        description: data.description,
        location: data.location,
        date: new Date(data.date),
        capacity: data.capacity,
        pointsReward: data.pointsReward,
        imageUrl: data.imageUrl,
        latitude: data.latitude,
        longitude: data.longitude,
        managedById: data.managedById,
      },
      include: {
        registrations: { select: { id: true } },
        managedBy: { select: { id: true, name: true, email: true } }
      }
    });
  }

  static async updateEvent(id: string, data: Partial<{
    title: string;
    description: string;
    location: string;
    date: string;
    capacity: number;
    pointsReward: number;
    imageUrl: string;
    latitude: number;
    longitude: number;
  }>) {
    const updateData: any = { ...data };
    if (data.date) updateData.date = new Date(data.date);
    return await prisma.event.update({
      where: { id },
      data: updateData,
      include: {
        registrations: { select: { id: true } },
        managedBy: { select: { id: true, name: true, email: true } }
      }
    });
  }

  static async deleteEvent(id: string) {
    return await prisma.event.delete({ where: { id } });
  }
}
