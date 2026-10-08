import { prisma } from "../prismaClient";
import { selectChallengeSubmissionPage, type ChallengeSubmissionPageFilters } from './challengeSubmissionPages';
import { contentBadgeWrite } from './contentBadgeService';
import { presenceQueryService } from './presenceQueryService';
import { PRESENCE_STALE_TTL_MS } from './presenceService';
import { supabaseRealtimeService } from './supabaseRealtimeService';
import { sendDirectNotification } from './notificationService';
import { apiCache } from "../lib/cache";
import { getTotalCoinsRedeemed } from './redemptionStatsService';
import { activityByDayQuery } from './adminActivityTrend';

type ReviewerContext = {
  role: string;
  city?: string | null;
};

function runSubmissionFollowUps(label: string, tasks: Array<() => Promise<unknown>>) {
  void Promise.allSettled(tasks.map((task) => Promise.resolve().then(task))).then((results) => {
    for (const result of results) {
      if (result.status === 'rejected') {
        console.error(`${label} follow-up failed after save.`, result.reason);
      }
    }
  });
}

// A challenge's category is the item it collects, so it always follows the AI detection targets.
function challengeCategoryFromTargets(targets: string[]) {
  if (targets.length === 0) return 'General';
  return targets.length === 1 ? targets[0] : 'Mixed Items';
}

export class AdminService {
  static async getAllLessons(page = 1, pageSize = 25, search?: string, status?: string, recordId?: string) {
    const where: any = {};
    if (recordId) where.id=recordId;
    if (search) where.title = { contains: search, mode: 'insensitive' };
    if (status === 'Published') where.isPublished = true;
    if (status === 'Draft') { where.isPublished = false; where.scheduledAt = null; }
    if (status === 'Auto Publish') { where.isPublished = false; where.scheduledAt = { not: null }; }
    return apiCache.getOrSet(`admin_lessons_list:${page}:${pageSize}:${status || 'All'}:${search || ''}:${recordId || ''}`, 30, async () => {
      const startedAt = Date.now();

      try {
        const [lessons, total] = await Promise.all([prisma.lesson.findMany({
          where,
          skip: (page - 1) * pageSize,
          take: pageSize,
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
        }), prisma.lesson.count({ where })]);

        console.log(`[PERF] getAllLessons DB: ${Date.now() - startedAt}ms`);

        return { items: lessons, pagination: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) } };
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
    badgeReward?: unknown;
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
        badge: contentBadgeWrite(data.badgeReward, 'lesson', true),
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

    apiCache.delete('system_badges_list');
    apiCache.invalidatePrefix('learn_published_');
    apiCache.invalidatePrefix('learn_catalog_');
    apiCache.delete('total_lessons_count');
    apiCache.invalidatePrefix('admin_lessons_list:');
    apiCache.delete('admin_dashboard_stats');
    apiCache.invalidatePrefix('admin_activity_trend:');

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
    const { quizQuestions, pages, badgeReward, ...otherData } = data;

    // If quiz questions or pages are provided, we delete existing and recreate
    let updatePayload: any = { ...otherData, badge: contentBadgeWrite(badgeReward, 'lesson') };

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

    apiCache.delete('system_badges_list');
    apiCache.invalidatePrefix('learn_published_');
    apiCache.invalidatePrefix('learn_catalog_');
    apiCache.delete('total_lessons_count');
    apiCache.invalidatePrefix('admin_lessons_list:');
    apiCache.delete('admin_dashboard_stats');
    apiCache.invalidatePrefix('admin_activity_trend:');

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
    apiCache.invalidatePrefix('learn_catalog_');
    apiCache.delete('total_lessons_count');
    apiCache.invalidatePrefix('admin_lessons_list:');
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
    apiCache.invalidatePrefix('learn_catalog_');
    apiCache.delete('total_lessons_count');
    apiCache.invalidatePrefix('admin_lessons_list:');
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
    const updated = await prisma.userStats.update({
      where: { userId },
      data: { knowledgePoints: 0 }
    });
    apiCache.delete(`user_dashboard_${userId}`);
    return updated;
  }

  static async getUsers(options: { page: number; pageSize: number; search?: string; role?: string }) {
    return presenceQueryService.getAdminUsers(options);
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

    apiCache.delete('admin_dashboard_stats');
    apiCache.invalidatePrefix('admin_activity_trend:');
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

    apiCache.delete('admin_dashboard_stats');
    apiCache.invalidatePrefix('admin_activity_trend:');
    await supabaseRealtimeService.publishAdminSectionRefresh('users', {
      actorRole: 'admin',
      actorUserId: adminId,
      entityId: userId,
      reason: 'user-unblocked',
    });

    return user;
  }

  // Challenge Management
  static async getAllChallenges(page = 1, pageSize = 25, search?: string, status?: string, recordId?: string) {
    const now = new Date();
    const where: any = {};
    if (recordId) where.id=recordId;
    if (search) where.title = { contains: search, mode: 'insensitive' };
    if (status === 'Expired') where.endDate = { lt: now };
    if (status === 'Active') { where.active = true; where.OR = [{ endDate: null }, { endDate: { gte: now } }]; }
    if (status === 'Inactive') { where.active = false; where.OR = [{ endDate: null }, { endDate: { gte: now } }]; }
    return apiCache.getOrSet(`admin_challenges_list:${page}:${pageSize}:${status || 'All'}:${search || ''}:${recordId || ''}`, 30, async () => {
      const [items, total] = await Promise.all([
        prisma.challenge.findMany({ where, skip: (page - 1) * pageSize, take: pageSize, orderBy: { createdAt: 'desc' } }),
        prisma.challenge.count({ where }),
      ]);
      return { items, pagination: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) } };
    });
  }

  static async createChallenge(data: {
    badgeReward?: unknown;
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
    requirementType?: string;
    requirementTarget?: string;
    requirementUnit?: string;
    additionalInstructions?: string;
    collectionPointName?: string;
    collectionPointLat?: number;
    collectionPointLng?: number;
    requireLocation?: boolean;
  }) {
    const aiDetectionTargets = data.aiDetectionTargets && data.aiDetectionTargets.length > 0 ? data.aiDetectionTargets : ["Plastic Bottle", "Glass Bottle", "Plastic Wrapper"];
    const challenge = await prisma.challenge.create({
      data: {
        badge: contentBadgeWrite(data.badgeReward, 'challenge', true),
        title: data.title,
        description: data.description,
        difficulty: data.difficulty,
        startDate: data.startDate ? new Date(data.startDate) : null,
        endDate: data.endDate ? new Date(data.endDate) : null,
        expReward: data.expReward,
        ecoCoinReward: data.ecoCoinReward || 0,
        category: challengeCategoryFromTargets(aiDetectionTargets),
        active: data.active ?? true,
        imageUrl: data.imageUrl,
        badgeLabel: data.badgeLabel,
        type: data.type || "AI Image Recognition Challenge",
        aiDetectionTargets,
        aiMinimumConfidence: data.aiMinimumConfidence || 80,
        isFeatured: data.isFeatured ?? false,
        quantityUnit: data.quantityUnit || "bottles",
        requirementType: data.requirementType || "quantity",
        requirementTarget: data.requirementTarget || "1",
        requirementUnit: data.requirementUnit || "piece",
        additionalInstructions: data.additionalInstructions?.trim() || null,
        collectionPointName: data.collectionPointName || "Municipal Waste Collection Center",
        collectionPointLat: data.collectionPointLat ?? null,
        collectionPointLng: data.collectionPointLng ?? null,
        requireLocation: data.requireLocation ?? false,
      }
    });

    apiCache.delete('system_badges_list');
    apiCache.invalidatePrefix('admin_challenges_list:');
    apiCache.delete('global_active_challenges_with_instances');


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
    const { badgeReward, ...fields } = data;
    if (Array.isArray(fields.aiDetectionTargets)) fields.category = challengeCategoryFromTargets(fields.aiDetectionTargets);
    const challenge = await prisma.challenge.update({
      where: { id },
      data: { ...fields, badge: contentBadgeWrite(badgeReward, 'challenge') }
    });

    apiCache.delete('system_badges_list');
    apiCache.invalidatePrefix('admin_challenges_list:');
    apiCache.delete('global_active_challenges_with_instances');


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

    apiCache.invalidatePrefix('admin_challenges_list:');
    apiCache.delete('global_active_challenges_with_instances');


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
      return { start, end };
    });

    const cachedTrend = apiCache.get<any[]>(`admin_activity_trend:${days[0].start.toISOString().slice(0, 10)}`);
    if (cachedTrend) return cachedTrend;

    const counts = await prisma.$queryRaw<{ idx: number; active: number; signups: number }[]>(
      activityByDayQuery(days),
    );
    const countsByDay = new Map(counts.map((row) => [row.idx, row]));

    const result = days.map(({ start }, idx) => ({
      active: countsByDay.get(idx)?.active ?? 0,
      date: start.toISOString(),
      dateLabel: start.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }),
      day: start.toLocaleDateString('en-US', { weekday: 'short' }),
      signups: countsByDay.get(idx)?.signups ?? 0,
    }));
    apiCache.set(`admin_activity_trend:${days[0].start.toISOString().slice(0, 10)}`, result, 60);
    return result;
  }

  static async getDashboardStats() {
    return apiCache.getOrSet('admin_dashboard_stats', 60, async () => {
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
        totalCoinsRedeemed,
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
        getTotalCoinsRedeemed(),
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
          totalCoinsRedeemed,
          totalUsers,
          totalSignups: totalUsers,
        },
        presence: presenceOverview,
        activityTrend,
      };
    });
  }

  static invalidateDashboardStats() {
    apiCache.delete('admin_dashboard_stats');
    apiCache.invalidatePrefix('admin_activity_trend:');
  }

  static async getSubmissions(
    filterBarangay?: string | null,
    submissionType: 'all' | 'challenge' | 'event' = 'all',
    page = 1,
    pageSize = 25,
    groupFilters?: ChallengeSubmissionPageFilters,
    recordId?: string,
  ) {
    const skip = (page - 1) * pageSize;
    const readSkip = submissionType === 'all' ? 0 : skip;
    const readTake = submissionType === 'all' ? skip + pageSize : pageSize;
    const barangay = filterBarangay?.trim() || undefined;
    const groupedPage = submissionType === 'challenge' && groupFilters && !recordId
      ? await selectChallengeSubmissionPage(barangay, page, groupFilters) : null;
    const scope = groupedPage ? { id: { in: groupedPage.ids } } : barangay
      ? { user: { profile: { city: { equals: barangay, mode: 'insensitive' as const } } } }
      : undefined;
    const where = recordId ? { ...scope,id:recordId } : scope;
    const challengeSubs = submissionType === 'event' ? [] : await prisma.challengeSubmission.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: groupedPage ? undefined : readSkip,
      take: groupedPage ? undefined : readTake,
      select: {
        id: true,
        userId: true,
        challengeInstanceId: true,
        proofText: true,
        proofUrl: true,
        afterProofUrl: true,
        status: true,
        moderatorNotes: true,
        detectedQuantity: true,
        reservedQuantity: true,
        createdAt: true,
        rewardAwarded: true,
        user: {
          select: {
            id: true,
            name: true,
            profile: { select: { displayName: true, avatarUrl: true, city: true } }
          }
        },
        challengeInstance: {
          select: {
            challengeId: true,
            challenge: { select: { id: true, title: true, type: true, quantityUnit: true, collectionPointName: true } },
          }
        }
      }
    });

    const eventSubs = submissionType === 'challenge' ? [] : await prisma.eventSubmission.findMany({
      where,
      orderBy: { submittedAt: 'desc' },
      skip: groupedPage ? undefined : readSkip,
      take: groupedPage ? undefined : readTake,
      select: {
        id: true,
        userId: true,
        eventId: true,
        qrVerified: true,
        attendanceImageUrl: true,
        status: true,
        rejectionReason: true,
        submittedAt: true,
        user: {
          select: {
            id: true,
            name: true,
            profile: { select: { displayName: true, avatarUrl: true, city: true } }
          }
        },
        event: { select: { title: true } }
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
    if (groupedPage) return { items: unified, pagination: groupedPage.pagination, filterOptions: groupedPage.filterOptions };
    const [challengeTotal, eventTotal] = await Promise.all([
      submissionType === 'event' ? 0 : prisma.challengeSubmission.count({ where }),
      submissionType === 'challenge' ? 0 : prisma.eventSubmission.count({ where }),
    ]);
    const items = submissionType === 'all' ? unified.slice(skip, skip + pageSize) : unified;
    const total = challengeTotal + eventTotal;
    if (recordId && submissionType==='challenge' && groupFilters) {
      const residents=new Map(challengeSubs.map(item=>[item.userId,{ id:item.userId,name:item.user.profile?.displayName || item.user.name }]));
      const barangays=[...new Set(challengeSubs.map(item=>item.user.profile?.city?.trim() || 'Unassigned Barangay'))];
      return { items,pagination:{ page,pageSize,total,totalPages:Math.max(1,Math.ceil(total/pageSize)),totalResidents:residents.size,totalBarangays:barangays.length },filterOptions:{ users:[...residents.values()],barangays } };
    }
    return { items, pagination: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) } };
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
            user: { include: { profile: true } }
          }
        });

        this.invalidateDashboardStats();
        const { user, ...submissionResponse } = submission;
        const safeSubmission = {
          ...submissionResponse,
          user: user ? {
            id: user.id,
            name: user.name,
            email: user.email,
            profile: user.profile,
          } : null,
        };

        // The review is committed at this point. Audit, realtime, and push
        // notifications must not turn a successful approval into an API error.
        runSubmissionFollowUps('Preliminary challenge approval', [
          () => prisma.auditLog.create({
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
          }),
          () => supabaseRealtimeService.publishUserSectionBundle(
            submission.userId,
            ['challenges', 'tracker'],
            {
              actorRole: 'admin',
              actorUserId: reviewerId,
              entityId: submission.challengeInstanceId,
              reason: 'submission-approved_collection',
            },
          ),
          () => sendDirectNotification({
            userId: submission.userId,
            type: 'challenge',
            message: `Your proof for "${challenge?.title}" was approved! Please submit your After Photo.`,
            title: 'Pending After Photo',
            relatedId: submission.challengeInstanceId,
            relatedType: 'challenge',
            priority: 'high',
            notificationKey: `admin_challenge_collection_approved:${submission.id}`,
          }),
        ]);

        return safeSubmission;
      }

      // Handle Rejection -> If quantity was reserved, return/refund it back to availableQuantity
      if (status === 'rejected') {
        const reserved = challengeSub.reservedQuantity || 0;

        const updated = await prisma.$transaction(async (tx) => {
          if (reserved > 0 && challenge?.id) {
            await tx.challenge.update({
              where: { id: challenge.id },
              data: {
                availableQuantity: { increment: reserved }
              }
            });
          }

          return tx.challengeSubmission.update({
            where: { id },
            data: {
              status: 'rejected',
              moderatorNotes: notes,
              reviewedById: reviewerId,
              reviewedAt: new Date(),
              reservedQuantity: 0,
            },
            include: {
              challengeInstance: { include: { challenge: true } },
              user: { include: { profile: true } },
            },
          });
        });

        this.invalidateDashboardStats();
        const { user, ...submissionResponse } = updated;
        const safeSubmission = {
          ...submissionResponse,
          user: user ? { id: user.id, name: user.name, email: user.email, profile: user.profile } : null,
        };

      runSubmissionFollowUps('Challenge rejection', [
          () => prisma.auditLog.create({
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
          }),
          () => supabaseRealtimeService.publishUserSectionBundle(
          challengeSub.userId,
          ['challenges', 'tracker'],
          {
            actorRole: 'admin',
            actorUserId: reviewerId,
            entityId: challengeSub.challengeInstanceId,
            reason: 'submission-rejected',
          },
          ),
          () => sendDirectNotification({
          userId: challengeSub.userId,
          type: 'challenge',
          message: `Your proof for "${challenge?.title}" was rejected.${notes ? ` Notes: ${notes}` : ''}`,
          title: 'Challenge submission rejected',
          relatedId: challengeSub.challengeInstanceId,
          relatedType: 'challenge',
          priority: 'high',
          notificationKey: `admin_challenge_rejected:${challengeSub.id}`,
          }),
        ]);

        return safeSubmission;
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
          user: { include: { profile: true } }
        }
      });

      this.invalidateDashboardStats();
      const { user, ...submissionResponse } = submission;
      const safeSubmission = {
        ...submissionResponse,
        user: user ? {
          id: user.id,
          name: user.name,
          email: user.email,
          profile: user.profile,
        } : null,
      };

      // The final review is committed at this point. Audit, realtime, and push
      // notifications must not turn a successful approval into an API error.
        runSubmissionFollowUps('Final challenge approval', [
        () => prisma.auditLog.create({
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
        }),
        () => supabaseRealtimeService.publishUserSectionBundle(
          submission.userId,
          ['challenges', 'tracker'],
          {
            actorRole: 'admin',
            actorUserId: reviewerId,
            entityId: submission.challengeInstanceId,
            reason: 'submission-approved',
          },
        ),
        () => sendDirectNotification({
          userId: submission.userId,
          type: 'challenge',
          message: `Your mission for "${submission.challengeInstance?.challenge?.title}" is officially approved! You can now claim your reward.`,
          title: 'Challenge fully approved',
          relatedId: submission.challengeInstanceId,
          relatedType: 'challenge',
          priority: 'high',
          notificationKey: `admin_challenge_approved:${submission.id}`,
        }),
        () => supabaseRealtimeService.publishAdminSectionBundle(['dashboard', 'users'], {
          actorRole: 'admin',
          actorUserId: reviewerId,
          entityId: submission.userId,
          reason: 'submission-approved',
        }),
      ]);

      return safeSubmission;
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
      const submission = await prisma.$transaction(async (tx) => {
        const updatedSubmission = await tx.eventSubmission.update({
          where: { id },
          data: {
            status: eventStatus as any,
            rejectionReason: notes,
            reviewedAt: new Date()
          },
          include: {
            event: { select: { title: true } },
            user: {
              select: {
                id: true,
                name: true,
                profile: { select: { displayName: true, avatarUrl: true, city: true } },
              },
            },
          }
        });

        await tx.eventRegistration.update({
          where: { userId_eventId: { userId: updatedSubmission.userId, eventId: updatedSubmission.eventId } },
          data: {
            status: status === 'approved' ? 'ATTENDED' : 'REGISTERED',
            attendedAt: status === 'approved' ? new Date() : null
          }
        });
        return updatedSubmission;
      });

      this.invalidateDashboardStats();
      runSubmissionFollowUps(`Event attendance ${status}`, [
        () => prisma.auditLog.create({
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
        }),
        () => sendDirectNotification({
          userId: submission.userId,
          type: 'event',
          message:
            status === 'approved'
              ? `Your attendance for event "${submission.event.title}" has been approved.`
              : `Your attendance for event "${submission.event.title}" was rejected.${notes ? ` Notes: ${notes}` : ''}`,
          title: status === 'approved' ? 'Event Attendance Approved' : 'Event Attendance Rejected',
          relatedId: submission.eventId,
          relatedType: 'event',
          notificationKey: `event_submission_${eventStatus}:${submission.id}:${submission.reviewedAt?.getTime()}`,
        }),
        () => supabaseRealtimeService.publishUserEventsRefresh(submission.userId, { entityId: submission.eventId, reason: 'event-attendance-reviewed' }),
        () => supabaseRealtimeService.publishAdminSectionRefresh('dashboard', { actorRole: 'moderator', actorUserId: reviewerId, entityId: submission.eventId, reason: 'event-attendance-reviewed' }),
      ]);

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
    const submission = await prisma.challengeSubmission.delete({
      where: { id },
    });
    this.invalidateDashboardStats();
    return submission;
  }

  static async deleteEventSubmission(id: string, _reviewerContext?: ReviewerContext) {
    const sub = await prisma.eventSubmission.findUnique({ where: { id } });
    if (sub) {
      await prisma.eventRegistration.updateMany({
        where: { userId: sub.userId, eventId: sub.eventId, status: 'PENDING_APPROVAL' },
        data: { status: 'REGISTERED' }
      });
    }
    const submission = await prisma.eventSubmission.delete({
      where: { id },
    });
    this.invalidateDashboardStats();
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
      take: 30
    });
  }

  static async clearAuditLogs() {
    return await prisma.auditLog.deleteMany({});
  }

  // Event Management
  static async getAllEvents(page = 1, pageSize = 25, search?: string, barangay?: string, recordId?: string) {
    const where: any = search ? { title: { contains: search, mode: 'insensitive' } } : {};
    if (recordId) where.id=recordId;
    if (barangay) where.barangay = barangay === 'all-residents' ? null : barangay;
    return apiCache.getOrSet(`admin_events:${page}:${pageSize}:${search || ''}:${barangay || ''}:${recordId || ''}`, 15, async () => {
      const now = new Date();
      const upcomingWhere = { ...where, startDatetime: { gte: now } };
      const pastWhere = { ...where, startDatetime: { lt: now } };
      const [total, upcomingCount] = await Promise.all([
        prisma.event.count({ where }),
        prisma.event.count({ where: upcomingWhere }),
      ]);
      const offset = (page - 1) * pageSize;
      const upcomingTake = Math.min(pageSize, Math.max(0, upcomingCount - offset));
      const include = {
        _count: { select: { registrations: true } },
        managedBy: {
          select: { id: true, name: true, email: true, role: true }
        }
      };
      const [upcoming, past] = await Promise.all([
        upcomingTake > 0 ? prisma.event.findMany({
          where: upcomingWhere, skip: offset, take: upcomingTake,
          orderBy: [{ startDatetime: 'asc' }, { id: 'asc' }], include,
        }) : Promise.resolve([]),
        upcomingTake < pageSize ? prisma.event.findMany({
          where: pastWhere, skip: Math.max(0, offset - upcomingCount), take: pageSize - upcomingTake,
          orderBy: [{ startDatetime: 'desc' }, { id: 'asc' }], include,
        }) : Promise.resolve([]),
      ]);
      const events = [...upcoming, ...past];
      const items = events.map(({ _count, ...event }) => ({ ...event, registrationCount: _count.registrations }));
      return { items, pagination: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) } };
    });
  }

  static async createEvent(data: {
    badgeReward?: unknown;
    officialName?: string | null;
    officialPosition?: string | null;
    targetAudience?: string;
    barangay?: string | null;
    isPublished?: boolean;
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
    const event = await prisma.event.create({
      data: {
        badge: contentBadgeWrite(data.badgeReward, 'event', true),
        title: data.title,
        barangay: data.barangay ?? null,
        targetAudience: data.targetAudience ?? 'Residents',
        officialName: data.officialName ?? null,
        officialPosition: data.officialPosition ?? null,
        isPublished: data.isPublished ?? true,
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
    apiCache.delete('system_badges_list');
    apiCache.invalidatePrefix('admin_events:');
    await supabaseRealtimeService.publishGlobalSectionRefresh('events', {
      actorRole: 'admin', actorUserId: data.managedById, entityId: event.id, reason: 'event-created',
    });
    void prisma.eventRegistration.findMany({ where: { eventId: event.id }, select: { userId: true } }).then((rows) =>
      Promise.all(rows.map((row) => supabaseRealtimeService.publishUserEventsRefresh(row.userId, { entityId: event.id, reason: 'event-created' })))
    ).catch(() => {});
    return event;
  }

  static async updateEvent(id: string, data: Partial<{
    badgeReward: unknown;
    officialName: string | null;
    officialPosition: string | null;
    targetAudience: string;
    barangay: string | null;
    isPublished: boolean;
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
    const { badgeReward, ...eventFields } = data;
    const updateData: any = { ...eventFields, badge: contentBadgeWrite(badgeReward, 'event') };
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
    const event = await prisma.event.update({
      where: { id },
      data: updateData,
      include: {
        registrations: { select: { id: true } },
        managedBy: { select: { id: true, name: true, email: true } }
      }
    });
    apiCache.delete('system_badges_list');
    apiCache.invalidatePrefix('admin_events:');
    await supabaseRealtimeService.publishGlobalSectionRefresh('events', {
      actorRole: 'admin', entityId: id, reason: 'event-updated',
    });
    void prisma.eventRegistration.findMany({ where: { eventId: id }, select: { userId: true } }).then((rows) =>
      Promise.all(rows.map((row) => supabaseRealtimeService.publishUserEventsRefresh(row.userId, { entityId: id, reason: 'event-updated' })))
    ).catch(() => {});
    return event;
  }

  static async deleteEvent(id: string) {
    const event = await prisma.event.delete({ where: { id } });
    apiCache.invalidatePrefix('admin_events:');
    await supabaseRealtimeService.publishGlobalSectionRefresh('events', {
      actorRole: 'admin', entityId: id, reason: 'event-deleted',
    });
    return event;
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
