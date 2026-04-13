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
        }
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
  }) {
    const lesson = await prisma.lesson.create({
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

  static async updateLesson(id: string, data: Partial<{
    title: string;
    description: string;
    content: string;
    isPublished: boolean;
  }>) {
    const lesson = await prisma.lesson.update({
      where: { id },
      data
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
    pointsReward: number;
    category?: string;
    active?: boolean;
    imageUrl?: string;
    badgeLabel?: string;
  }) {
    const challenge = await prisma.challenge.create({
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
          points: { increment: submission.challenge.pointsReward }
        }
      });

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
}
