import { prisma } from "../prismaClient";
import { presenceQueryService } from './presenceQueryService';
import { PRESENCE_STALE_TTL_MS } from './presenceService';
import { supabaseRealtimeService } from './supabaseRealtimeService';
import { sendDirectNotification } from './notificationService';
import { apiCache } from "../lib/cache";

type ReviewerContext = {
  role: string;
  city?: string | null;
};

export class AdminService {
  static async getAllLessons() {
    return apiCache.getOrSet('admin_lessons_list', 30, async () => {
      const startedAt = Date.now();

      try {
        const lessons = await prisma.lesson.findMany({
          orderBy: { createdAt: 'desc' },
          // The table view does not need lesson bodies, transcripts, pages, or
          // quiz answers. Those can be very large and made every list refresh
          // serialize and transfer the complete course catalogue.
          select: {
            id: true,
            title: true,
            description: true,
            category: true,
            difficulty: true,
            durationMinutes: true,
            rating: true,
            pointsReward: true,
            isPublished: true,
            featured: true,
            videoUrl: true,
            imageUrl: true,
            createdAt: true,
            updatedAt: true,
            scheduledAt: true,
            createdBy: {
              select: {
                id: true,
                name: true,
                email: true
              }
            },
            _count: { select: { quizQuestions: true, pages: true } },
          }
        });

        console.log(`[PERF] getAllLessons DB: ${Date.now() - startedAt}ms`);

        return lessons;
      } catch (error) {
        console.error(`[PERF] getAllLessons failed after ${Date.now() - startedAt}ms`);
        throw error;
      }
    });
  }

  static async getLessonById(id: string) {
    return prisma.lesson.findUnique({
      where: { id },
      include: {
        createdBy: { select: { id: true, name: true, email: true } },
        quizQuestions: true,
        pages: { orderBy: { order: 'asc' } },
      },
    });
  }

  static async createLesson(data: {
    title: string;
    description: string;
    content: string;
    isPublished: boolean;
    createdById: string;
    category: string;
    difficulty?: string;
    videoUrl?: string | null;
    imageUrl?: string | null;
    transcript?: string | null;
    durationMinutes?: number;
    quizPassingScore?: number;
    pointsReward?: number;
    quizQuestions?: any[];
    pages?: any[];
    featured?: boolean;
    scheduledAt?: Date | null;
  }) {
    const lesson = await prisma.lesson.create({
      data: {
        title: data.title,
        description: data.description,
        content: data.content,
        isPublished: data.isPublished,
        createdById: data.createdById,
        category: data.category || "General",
        difficulty: data.difficulty || "Beginner",
        videoUrl: data.videoUrl,
        imageUrl: data.imageUrl,
        transcript: data.transcript,
        durationMinutes: data.durationMinutes ?? 0,
        quizPassingScore: data.quizPassingScore ?? 70,
        pointsReward: data.pointsReward ?? 10,
        featured: data.featured ?? false,
        scheduledAt: data.scheduledAt,
        quizQuestions: data.quizQuestions?.length ? {
          create: data.quizQuestions.map((q: any) => ({
            question: q.question,
            optionA: q.optionA,
            optionB: q.optionB,
            optionC: q.optionC,
            optionD: q.optionD,
            correctAnswer: q.correctAnswer
          }))
        } : undefined,
        pages: data.pages?.length ? {
          create: data.pages.map((p: any, index: number) => ({
            title: p.title || `Page ${index + 1}`,
            description: p.description || '',
            content: p.content || '',
            order: index
          }))
        } : undefined
      },
      include: {
        pages: { orderBy: { order: 'asc' } },
        quizQuestions: true
      }
    });

    apiCache.invalidatePrefix('learn_published_');
    apiCache.delete('total_lessons_count');
    apiCache.delete('admin_lessons_list');
    apiCache.delete('admin_dashboard_stats');

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
    const { quizQuestions, pages, ...otherData } = data;

    // If quiz questions or pages are provided, we delete existing and recreate
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

    if ('featured' in updatePayload && typeof updatePayload.featured === 'string') {
      updatePayload.featured = updatePayload.featured === 'true';
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

    if (pages) {
      updatePayload.pages = {
        deleteMany: {},
        create: pages.map((p: any, index: number) => ({
          title: p.title || `Page ${index + 1}`,
          description: p.description || '',
          content: p.content || '',
          order: index
        }))
      };
    }

    const lesson = await prisma.lesson.update({
      where: { id },
      data: updatePayload,
      include: {
        pages: { orderBy: { order: 'asc' } },
        quizQuestions: true
      }
    });

    apiCache.invalidatePrefix('learn_published_');
    apiCache.delete('total_lessons_count');
    apiCache.delete('admin_lessons_list');
    apiCache.delete('admin_dashboard_stats');

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

    apiCache.invalidatePrefix('learn_published_');
    apiCache.delete('total_lessons_count');
    apiCache.delete('admin_lessons_list');
    apiCache.delete('admin_dashboard_stats');

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

    apiCache.invalidatePrefix('learn_published_');
    apiCache.delete('total_lessons_count');
    apiCache.delete('admin_lessons_list');
    apiCache.delete('admin_dashboard_stats');

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

  static async toggleFeature(id: string, featured: boolean) {
    const lesson = await prisma.lesson.update({
      where: { id },
      data: { featured }
    });

    await Promise.all([
      supabaseRealtimeService.publishGlobalSectionRefresh('learn', {
        actorRole: 'admin',
        entityId: id,
        reason: featured ? 'lesson-featured' : 'lesson-unfeatured',
      }),
      supabaseRealtimeService.publishAdminSectionRefresh('dashboard', {
        actorRole: 'admin',
        entityId: id,
        reason: featured ? 'lesson-featured' : 'lesson-unfeatured',
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

  static async blockUser(userId: string, adminId: string) {
    const user = await prisma.user.update({
      where: { id: userId },
      data: { status: 'suspended' }
    });

    await prisma.auditLog.create({
      data: {
        action: 'USER_BLOCKED',
        userId,
        details: JSON.stringify({ adminId }),
        timestamp: new Date()
      }
    });

    await supabaseRealtimeService.publishAdminSectionRefresh('users', {
      actorRole: 'admin',
      actorUserId: adminId,
      entityId: userId,
      reason: 'user-blocked',
    });

    return user;
  }

  static async unblockUser(userId: string, adminId: string) {
    const user = await prisma.user.update({
      where: { id: userId },
      data: { status: 'active' }
    });

    await prisma.auditLog.create({
      data: {
        action: 'USER_UNBLOCKED',
        userId,
        details: JSON.stringify({ adminId }),
        timestamp: new Date()
      }
    });

    await supabaseRealtimeService.publishAdminSectionRefresh('users', {
      actorRole: 'admin',
      actorUserId: adminId,
      entityId: userId,
      reason: 'user-unblocked',
    });

    return user;
  }

  // Challenge Management
  static async getAllChallenges() {
    return await prisma.challenge.findMany({
      include: { instances: { orderBy: { startDate: 'desc' } } },
      orderBy: { createdAt: 'desc' }
    });
  }

  static async createChallenge(data: {
    title: string;
    description: string;
    difficulty: string;
    startDate?: string | null;
    endDate?: string | null;
    expReward: number;
    ecoCoinReward?: number;
    category?: string;
    active?: boolean;
    imageUrl?: string;
    badgeLabel?: string;
    type?: string;
    aiDetectionTargets?: string[];
    aiMinimumConfidence?: number;
    isFeatured?: boolean;
    targetQuantity?: number;
    availableQuantity?: number;
    weeklyIncrementQuantity?: number;
    quantityUnit?: string;
    collectionPointName?: string;
    collectionPointLat?: number;
    collectionPointLng?: number;
    requireLocation?: boolean;
  }) {
    const challenge = await prisma.challenge.create({
      data: {
        title: data.title,
        description: data.description,
        difficulty: data.difficulty,
        startDate: data.startDate ? new Date(data.startDate) : null,
        endDate: data.endDate ? new Date(data.endDate) : null,
        expReward: data.expReward,
        ecoCoinReward: data.ecoCoinReward || 0,
        category: data.category || "General",
        active: data.active ?? true,
        imageUrl: data.imageUrl,
        badgeLabel: data.badgeLabel,
        type: data.type || "AI Image Recognition Challenge",
        aiDetectionTargets: data.aiDetectionTargets && data.aiDetectionTargets.length > 0 ? data.aiDetectionTargets : ["Plastic Bottle", "Glass Bottle"],
        aiMinimumConfidence: data.aiMinimumConfidence || 80,
        isFeatured: data.isFeatured ?? false,
        availableQuantity: data.availableQuantity ?? 50,
        weeklyIncrementQuantity: data.weeklyIncrementQuantity ?? 50,
        quantityUnit: data.quantityUnit || "bottles",
        collectionPointName: data.collectionPointName || "Municipal Waste Collection Center",
        collectionPointLat: data.collectionPointLat ?? null,
        collectionPointLng: data.collectionPointLng ?? null,
        requireLocation: data.requireLocation ?? false,
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

  static async getSevenDayActivityTrend(snapshotDate: Date) {
    const days = [...Array(7)].map((_, i) => {
      const start = new Date(snapshotDate);
      start.setDate(snapshotDate.getDate() - (6 - i));
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setHours(23, 59, 59, 999);
      return { start, end, userIds: new Set<string>(), signups: 0 };
    });
    const range = { gte: days[0].start, lte: days[6].end };
    const addActivity = (userId: string, timestamp: Date | null) => {
      if (!timestamp) return;
      const day = days.find((candidate) => timestamp >= candidate.start && timestamp <= candidate.end);
      if (day) day.userIds.add(userId);
    };

    // Fetch the seven-day window once per data source. The former version
    // executed five database reads for every day (35 reads) just for this
    // chart, which saturated the connection pool on small instances.
    const [presenceRows, userRows, lessonRows, submissionRows, habitRows] = await Promise.all([
      prisma.presenceSession.findMany({
        where: { user: { role: 'user' }, OR: [{ lastSeenAt: range }, { connectedAt: range }, { updatedAt: range }] },
        select: { userId: true, lastSeenAt: true, connectedAt: true, updatedAt: true },
      }),
      prisma.user.findMany({
        where: { role: 'user', OR: [{ lastActionDate: range }, { createdAt: range }] },
        select: { id: true, lastActionDate: true, createdAt: true },
      }),
      prisma.userLessonProgress.findMany({
        where: { user: { role: 'user' }, OR: [{ updatedAt: range }, { createdAt: range }] },
        select: { userId: true, updatedAt: true, createdAt: true },
      }),
      prisma.challengeSubmission.findMany({
        where: { user: { role: 'user' }, OR: [{ createdAt: range }, { updatedAt: range }] },
        select: { userId: true, createdAt: true, updatedAt: true },
      }),
      prisma.habitCheckIn.findMany({
        where: { user: { role: 'user' }, createdAt: range },
        select: { userId: true, createdAt: true },
      }),
    ]);

    presenceRows.forEach((row) => {
      addActivity(row.userId, row.lastSeenAt);
      addActivity(row.userId, row.connectedAt);
      addActivity(row.userId, row.updatedAt);
    });
    userRows.forEach((row) => {
      addActivity(row.id, row.lastActionDate);
      addActivity(row.id, row.createdAt);
      const signupDay = days.find((candidate) => row.createdAt >= candidate.start && row.createdAt <= candidate.end);
      if (signupDay) signupDay.signups += 1;
    });
    lessonRows.forEach((row) => { addActivity(row.userId, row.updatedAt); addActivity(row.userId, row.createdAt); });
    submissionRows.forEach((row) => { addActivity(row.userId, row.createdAt); addActivity(row.userId, row.updatedAt); });
    habitRows.forEach((row) => addActivity(row.userId, row.createdAt));

    return days.map(({ start, userIds, signups }) => ({
      active: userIds.size,
      date: start.toISOString(),
      dateLabel: start.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }),
      day: start.toLocaleDateString('en-US', { weekday: 'short' }),
      signups,
    }));
  }

  static async getDashboardStats() {
    return apiCache.getOrSet('admin_dashboard_stats', 15, async () => {
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
        prisma.user.count({
          where: { role: 'user' }
        }),
        prisma.user.count({
          where: {
            createdAt: {
              gte: startOfToday,
              lte: endOfToday,
            },
            role: 'user',
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

      const activityTrend = await this.getSevenDayActivityTrend(snapshotDate);

      return {
        overview: {
          activeToday: presenceOverview.activeToday,
          lessonCompletions,
          onlineNow: presenceOverview.onlineUsers.length,
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
    });
  }

  static async getSubmissions(filterBarangay?: string | null) {
    const barangay = filterBarangay?.trim() || undefined;
    const where = barangay
      ? { user: { profile: { city: { equals: barangay, mode: 'insensitive' as const } } } }
      : undefined;
    const challengeSubs = await prisma.challengeSubmission.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            profile: true
          }
        },
        challengeInstance: { include: { challenge: true } }
      }
    });

    const eventSubs = await prisma.eventSubmission.findMany({
      where,
      orderBy: { submittedAt: 'desc' },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            profile: true
          }
        },
        event: true
      }
    });

    const unified = [
      ...challengeSubs.map(s => ({
        ...s,
        challenge: s.challengeInstance?.challenge || {
          id: s.challengeInstanceId,
          title: 'Eco Challenge',
          type: 'AI Image Recognition Challenge',
          quantityUnit: 'items'
        },
        submissionType: 'CHALLENGE'
      })),
      ...eventSubs.map(s => ({
        id: s.id,
        userId: s.userId,
        challengeId: s.eventId,
        proofText: s.qrVerified ? 'QR Code Scanned' : 'Event Attendance Photo',
        proofUrl: s.attendanceImageUrl,
        afterProofUrl: null,
        status: s.status,
        moderatorNotes: s.rejectionReason,
        createdAt: s.submittedAt,
        user: s.user,
        challenge: {
          id: s.eventId,
          title: `[EVENT] ${s.event.title}`,
          type: 'EVENT'
        },
        submissionType: 'EVENT'
      }))
    ];

    unified.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return unified;
  }

  static async reviewSubmission(id: string, reviewerId: string, status: 'approved' | 'rejected' | 'approved_collection', notes?: string, reviewerContext?: ReviewerContext) {
    const challengeSub = await prisma.challengeSubmission.findUnique({
      where: { id },
      include: {
        challengeInstance: { include: { challenge: true } },
        user: { include: { profile: true } }
      }
    });

    if (challengeSub) {
      if (reviewerContext?.role === 'moderator') {
        const assignedBarangay = reviewerContext.city?.trim().toLowerCase();
        const submissionBarangay = challengeSub.user.profile?.city?.trim().toLowerCase();
        if (!assignedBarangay || assignedBarangay !== submissionBarangay) {
          throw new Error('UNAUTHORIZED_BARANGAY_ACCESS');
        }
      }
      const challenge = challengeSub.challengeInstance?.challenge;

      // Handle preliminary approval (approved_collection)
      if (status === 'approved_collection') {
        const submission = await prisma.challengeSubmission.update({
          where: { id },
          data: {
            status: 'approved_collection',
            adminPreliminaryApproved: true,
            adminPreliminaryApprovedAt: new Date(),
            moderatorNotes: notes,
            reviewedById: reviewerId,
            reviewedAt: new Date(),
          },
          include: {
            challengeInstance: { include: { challenge: true } },
            user: true
          }
        });

        await prisma.auditLog.create({
          data: {
            action: 'SUBMISSION_APPROVED_COLLECTION',
            userId: submission.userId,
            details: JSON.stringify({
              submissionId: id,
              challengeTitle: challenge?.title,
              reviewerId,
              reservedQuantity: submission.reservedQuantity,
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
            entityId: submission.challengeInstanceId,
            reason: 'submission-approved_collection',
          },
        );

        await sendDirectNotification({
          userId: submission.userId,
          type: 'challenge',
          message: `Your proof for "${challenge?.title}" was approved! Please submit your After Photo.`,
          title: 'Pending After Photo',
          relatedId: submission.challengeInstanceId,
          relatedType: 'challenge',
          priority: 'high',
          notificationKey: `admin_challenge_collection_approved:${submission.id}`,
        });

        return submission;
      }

      // Handle Rejection -> If quantity was reserved, return/refund it back to availableQuantity
      if (status === 'rejected') {
        const reserved = challengeSub.reservedQuantity || 0;

        await prisma.$transaction(async (tx) => {
          if (reserved > 0 && challenge?.id) {
            await tx.challenge.update({
              where: { id: challenge.id },
              data: {
                availableQuantity: { increment: reserved }
              }
            });
          }

          await tx.challengeSubmission.update({
            where: { id },
            data: {
              status: 'rejected',
              moderatorNotes: notes,
              reviewedById: reviewerId,
              reviewedAt: new Date(),
              reservedQuantity: 0,
            }
          });
        });

        const updated = await prisma.challengeSubmission.findUnique({
          where: { id },
          include: {
            challengeInstance: { include: { challenge: true } },
            user: true
          }
        });

        await prisma.auditLog.create({
          data: {
            action: 'SUBMISSION_REJECTED',
            userId: challengeSub.userId,
            details: JSON.stringify({
              submissionId: id,
              challengeTitle: challenge?.title,
              reviewerId,
              refundedQuantity: reserved,
              notes
            }),
            timestamp: new Date()
          }
        });

        await supabaseRealtimeService.publishUserSectionBundle(
          challengeSub.userId,
          ['challenges', 'tracker'],
          {
            actorRole: 'admin',
            actorUserId: reviewerId,
            entityId: challengeSub.challengeInstanceId,
            reason: 'submission-rejected',
          },
        );

        await sendDirectNotification({
          userId: challengeSub.userId,
          type: 'challenge',
          message: `Your proof for "${challenge?.title}" was rejected.${notes ? ` Notes: ${notes}` : ''}`,
          title: 'Challenge submission rejected',
          relatedId: challengeSub.challengeInstanceId,
          relatedType: 'challenge',
          priority: 'high',
          notificationKey: `admin_challenge_rejected:${challengeSub.id}`,
        });

        return updated;
      }

      // Handle Final Approval (approved)
      const submission = await prisma.challengeSubmission.update({
        where: { id },
        data: {
          status: 'approved',
          adminFinalApproved: true,
          adminFinalApprovedAt: new Date(),
          moderatorNotes: notes,
          reviewedById: reviewerId,
          reviewedAt: new Date()
        },
        include: {
          challengeInstance: { include: { challenge: true } },
          user: true
        }
      });

      // Create Audit Log
      await prisma.auditLog.create({
        data: {
          action: 'SUBMISSION_APPROVED',
          userId: submission.userId,
          details: JSON.stringify({
            challengeId: submission.challengeInstanceId,
            challengeTitle: submission.challengeInstance?.challenge?.title,
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
          entityId: submission.challengeInstanceId,
          reason: 'submission-approved',
        },
      );

      await sendDirectNotification({
        userId: submission.userId,
        type: 'challenge',
        message: `Your mission for "${submission.challengeInstance?.challenge?.title}" is officially approved! You can now claim your reward.`,
        title: 'Challenge fully approved',
        relatedId: submission.challengeInstanceId,
        relatedType: 'challenge',
        priority: 'high',
        notificationKey: `admin_challenge_approved:${submission.id}`,
      });

      await supabaseRealtimeService.publishAdminSectionBundle(['dashboard', 'users'], {
        actorRole: 'admin',
        actorUserId: reviewerId,
        entityId: submission.userId,
        reason: 'submission-approved',
      });

      return submission;
    }

    const eventSub = await prisma.eventSubmission.findUnique({
      where: { id },
      include: { user: { include: { profile: true } } },
    });
    if (eventSub) {
      if (reviewerContext?.role === 'moderator') {
        const assignedBarangay = reviewerContext.city?.trim().toLowerCase();
        const submissionBarangay = eventSub.user.profile?.city?.trim().toLowerCase();
        if (!assignedBarangay || assignedBarangay !== submissionBarangay) {
          throw new Error('UNAUTHORIZED_BARANGAY_ACCESS');
        }
      }
      const eventStatus = status === 'approved' ? 'approved' : 'rejected';
      const submission = await prisma.eventSubmission.update({
        where: { id },
        data: {
          status: eventStatus as any,
          rejectionReason: notes,
          reviewedAt: new Date()
        },
        include: {
          event: true,
          user: true
        }
      });

      const eventReg = await prisma.eventRegistration.update({
        where: { userId_eventId: { userId: submission.userId, eventId: submission.eventId } },
        data: {
          status: status === 'approved' ? 'ATTENDED' : 'REGISTERED',
          attendedAt: status === 'approved' ? new Date() : null
        }
      });

      await prisma.auditLog.create({
        data: {
          action: `EVENT_SUBMISSION_${status.toUpperCase()}`,
          userId: submission.userId,
          details: JSON.stringify({
            eventId: submission.eventId,
            eventTitle: submission.event.title,
            reviewerId,
            notes
          }),
          timestamp: new Date()
        }
      });

      await supabaseRealtimeService.publishUserNotice(submission.userId, {
        level: status === 'approved' ? 'success' : 'warning',
        message:
          status === 'approved'
            ? `Your attendance for event "${submission.event.title}" has been approved.`
            : `Your attendance for event "${submission.event.title}" was rejected.${notes ? ` Notes: ${notes}` : ''}`,
        scope: 'moderation',
        title: status === 'approved' ? 'Event Attendance Approved' : 'Event Attendance Rejected',
      });

      return {
        id: submission.id,
        userId: submission.userId,
        challengeId: submission.eventId,
        proofText: submission.qrVerified ? 'QR Code Scanned' : 'Event Attendance Photo',
        proofUrl: submission.attendanceImageUrl,
        afterProofUrl: null,
        status: submission.status,
        moderatorNotes: submission.rejectionReason,
        createdAt: submission.submittedAt,
        user: submission.user,
        challenge: {
          id: submission.eventId,
          title: `[EVENT] ${submission.event.title}`,
          type: 'EVENT'
        },
        submissionType: 'EVENT'
      };
    }

    throw new Error('Submission not found');
  }

  static async deleteSubmission(id: string, _reviewerContext?: ReviewerContext) {
    return await prisma.challengeSubmission.delete({
      where: { id },
    });
  }

  static async deleteEventSubmission(id: string, _reviewerContext?: ReviewerContext) {
    const sub = await prisma.eventSubmission.findUnique({ where: { id } });
    if (sub) {
      await prisma.eventRegistration.updateMany({
        where: { userId: sub.userId, eventId: sub.eventId, status: 'PENDING_APPROVAL' },
        data: { status: 'REGISTERED' }
      });
    }
    return await prisma.eventSubmission.delete({
      where: { id },
    });
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
      take: 30
    });
  }

  static async clearAuditLogs() {
    return await prisma.auditLog.deleteMany({});
  }

  // Event Management
  static async getAllEvents() {
    return await prisma.event.findMany({
      orderBy: [
        { isFeatured: 'desc' },
        { startDatetime: 'asc' },
      ],
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
    startDatetime: string;
    endDatetime: string;
    capacity: number;
    pointsReward: number;
    coinReward?: number;
    imageUrl?: string;
    latitude?: number;
    longitude?: number;
    isFeatured?: boolean;
    managedById: string;
  }) {
    return await prisma.event.create({
      data: {
        title: data.title,
        description: data.description,
        location: data.location,
        startDatetime: new Date(data.startDatetime),
        endDatetime: new Date(data.endDatetime),
        capacity: data.capacity,
        ecoCoinsReward: data.coinReward ?? 0,
        expReward: data.pointsReward,
        managedById: data.managedById,
        imageUrl: data.imageUrl,
        latitude: data.latitude,
        longitude: data.longitude,
        isFeatured: data.isFeatured ?? false,
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
    startDatetime: string;
    endDatetime: string;
    capacity: number;
    pointsReward: number;
    coinReward: number;
    imageUrl: string;
    latitude: number;
    longitude: number;
    isFeatured: boolean;
  }>) {
    const updateData: any = { ...data };
    if (data.startDatetime) {
      updateData.startDatetime = new Date(data.startDatetime);
    }
    if (data.endDatetime) {
      updateData.endDatetime = new Date(data.endDatetime);
    }
    if (data.pointsReward !== undefined) {
      updateData.expReward = data.pointsReward;
      delete updateData.pointsReward;
    }
    if (data.coinReward !== undefined) {
      updateData.ecoCoinsReward = data.coinReward;
      delete updateData.coinReward;
    }
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

  static async getEventQr(eventId: string) {
    return await prisma.eventQrCode.findFirst({
      where: { eventId },
      orderBy: { createdAt: 'desc' },
    });
  }

  static async generateEventQr(eventId: string) {
    const event = await prisma.event.findUnique({ where: { id: eventId } });
    if (!event) throw new Error('Event not found');

    const qrData = require('crypto').randomBytes(16).toString('hex');

    // Set expiration to 1 hour after the event end time (or 24 hours if not set)
    const expiresAt = event.endDatetime
      ? new Date(new Date(event.endDatetime).getTime() + 60 * 60 * 1000)
      : new Date(Date.now() + 24 * 60 * 60 * 1000);

    return await prisma.eventQrCode.create({
      data: {
        eventId,
        qrData,
        expiresAt,
      }
    });
  }
}
