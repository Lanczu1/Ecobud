import { Router } from 'express';
import { prisma } from '../prismaClient';
import { authenticateRequest, AuthenticatedRequest, requireUserAccess } from '../http/authentication';
import { errorBoundary } from '../http/errorResponder';
import { chatRateLimiter } from '../http/chatRateLimiter';
import { getEcoGuideReply, type ChatHistoryMessage } from '../services/ecoGuideService';
import { resolveLiveStreak } from '../utils/gamificationUtils';

const experienceRoutes = Router();

const getDateKey = (date = new Date()) => {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
};




experienceRoutes.get(
  '/dashboard',
  authenticateRequest,
  requireUserAccess,
  errorBoundary(async (req: AuthenticatedRequest, res) => {
    const userId = req.auth!.userId;
    const today = getDateKey();
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);

    const [user, activeChallenges, featuredLessons, upcomingEvents, habits, recentCheckIns] =
      await Promise.all([
        prisma.user.findUnique({
          where: { id: userId },
          include: { profile: true },
        }),
        prisma.challenge.findMany({
          where: { active: true },
          include: {
            userChallenges: {
              where: { userId },
              orderBy: { startedAt: 'desc' },
              take: 1,
            },
          },
          orderBy: [{ difficulty: 'asc' }, { title: 'asc' }],
          take: 3,
        }),
        prisma.lesson.findMany({
          where: { featured: true },
          orderBy: { title: 'asc' },
          take: 3,
        }),
        prisma.eventRegistration.findMany({
          where: {
            userId,
            event: {
              date: {
                gte: new Date(),
              },
            },
          },
          include: { event: true },
          orderBy: { event: { date: 'asc' } },
        }),
        prisma.habit.findMany({
          where: { active: true },
          orderBy: { title: 'asc' },
        }),
        prisma.habitCheckIn.findMany({
          where: {
            userId,
            createdAt: {
              gte: sevenDaysAgo,
            },
          },
        }),
      ]);

    const weeklyPossible = Math.max(1, habits.length * 7);
    const weeklyProgress = Math.round((recentCheckIns.length / weeklyPossible) * 100);
    const primaryChallenge = activeChallenges[0];
    const activeChallengeProgress = primaryChallenge?.userChallenges[0] ?? null;

    return res.json({
      user: {
        displayName: user?.profile?.displayName ?? user?.name ?? 'Eco Explorer',
        points: user?.points ?? 0,
        currentStreak: resolveLiveStreak(user?.currentStreak ?? 0, user?.lastActionDate),
      },
      notificationsCount: Math.min(5, Math.max(1, upcomingEvents.length + 2)),
      weeklyProgress,
      dailyChallenge: primaryChallenge
        ? {
            ...primaryChallenge,
            progressPercentage: activeChallengeProgress?.progressPercentage ?? 65,
            deadlineLabel: 'Complete before 11:59 PM',
          }
        : null,
      learningHighlights: featuredLessons,
      upcomingEvents: upcomingEvents.map((item) => item.event),
      todayHabitCount: recentCheckIns.filter((item) => item.dateKey === today).length,
    });
  }),
);

experienceRoutes.get(
  '/tracker',
  authenticateRequest,
  requireUserAccess,
  errorBoundary(async (req: AuthenticatedRequest, res) => {
    const userId = req.auth!.userId;
    const month = typeof req.query.month === 'string' ? req.query.month : getDateKey().slice(0, 7);
    const [habits, checkIns, logs, user] = await Promise.all([
      prisma.habit.findMany({ where: { active: true }, orderBy: { title: 'asc' } }),
      prisma.habitCheckIn.findMany({
        where: {
          userId,
          dateKey: {
            startsWith: month,
          },
        },
        include: { habit: { select: { title: true } } },
      }),
      prisma.transparencyLog.findMany({
        where: {
          userId,
        timestamp: {
          gte: new Date(month + '-01T00:00:00+08:00'),
        }
      },
      select: { timestamp: true, actionType: true, pointsAwarded: true },
    }),
      prisma.user.findUnique({
        where: { id: userId },
        select: {
          currentStreak: true,
          points: true,
          lastActionDate: true,
        },
      }),
    ]);

    const today = getDateKey();
    const todaysHabitIds = new Set(
      checkIns.filter((item) => item.dateKey === today).map((item) => item.habitId),
    );
    const logDateKeys = logs.map(l => getDateKey(l.timestamp));
    const uniqueDays = new Set([
      ...checkIns.map((item) => item.dateKey),
      ...logDateKeys.filter(dk => dk.startsWith(month))
    ]);

    const logsByDate: Record<string, { title: string; points: number }[]> = {};
    
    logs.forEach(log => {
      const dk = getDateKey(log.timestamp);
      if (!logsByDate[dk]) logsByDate[dk] = [];
      logsByDate[dk].push({ title: log.actionType, points: log.pointsAwarded });
    });
    
    checkIns.forEach(ci => {
      const dk = ci.dateKey;
      if (!logsByDate[dk]) logsByDate[dk] = [];
      logsByDate[dk].push({ title: `Logged Habit: ${ci.habit.title}`, points: ci.pointsAwarded });
    });

    return res.json({
      month,
      currentStreak: resolveLiveStreak(user?.currentStreak ?? 0, user?.lastActionDate),
      points: user?.points ?? 0,
      weeklyGoalProgress: Math.min(100, Math.round((uniqueDays.size / 7) * 100)),
      completedDays: [...uniqueDays],
      logsByDate,
      todayHabits: habits.map((habit) => ({
        ...habit,
        completedToday: todaysHabitIds.has(habit.id),
      })),
    });
  }),
);

experienceRoutes.get(
  '/leaderboard',
  authenticateRequest,
  requireUserAccess,
  errorBoundary(async (req: AuthenticatedRequest, res) => {
    const currentUserId = req.auth!.userId;
    const users = await prisma.user.findMany({
      where: {
        status: 'active',
        role: 'user',
      },
      include: { profile: true, badges: { include: { badge: true } } },
      orderBy: [{ points: 'desc' }, { createdAt: 'asc' }],
      take: 10,
    });

    const currentUserIndex = users.findIndex((user) => user.id === currentUserId);

    return res.json({
      scope: 'global',
      items: users.map((user, index) => ({
        rank: index + 1,
        id: user.id,
        displayName: user.profile?.displayName ?? user.name,
        points: user.points,
        badges: user.badges.slice(0, 3).map((item) => item.badge.name),
        isCurrentUser: user.id === currentUserId,
      })),
      currentUserRank: currentUserIndex >= 0 ? currentUserIndex + 1 : null,
    });
  }),
);

experienceRoutes.get(
  '/rewards',
  authenticateRequest,
  requireUserAccess,
  errorBoundary(async (req: AuthenticatedRequest, res) => {
    const userId = req.auth!.userId;
    const [user, badges, userBadges, challengeCount, eventCount] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: { points: true },
      }),
      prisma.badge.findMany({ orderBy: { requiredPoints: 'asc' } }),
      prisma.userBadge.findMany({
        where: { userId },
      }),
      prisma.userChallenge.count({
        where: {
          userId,
          status: 'COMPLETED',
        },
      }),
      prisma.eventRegistration.count({
        where: {
          userId,
          status: 'ATTENDED',
        },
      }),
    ]);

    const unlockedBadgeIds = new Set(userBadges.map((item) => item.badgeId));

    return res.json({
      points: user?.points ?? 0,
      badges: badges.map((badge) => ({
        ...badge,
        unlocked: unlockedBadgeIds.has(badge.id),
      })),
      achievements: [
        {
          id: 'challenge-master',
          label: '50 Challenges Complete',
          current: challengeCount,
          target: 50,
          reward: 100,
        },
        {
          id: 'event-hero',
          label: '10 Community Events Joined',
          current: eventCount,
          target: 10,
          reward: 60,
        },
      ],
    });
  }),
);

experienceRoutes.post(
  '/assistant/chat',
  authenticateRequest,
  requireUserAccess,
  chatRateLimiter,
  errorBoundary(async (req: AuthenticatedRequest, res) => {
    const message = typeof req.body?.message === 'string' ? req.body.message : '';

    // Accept conversation history from the client (capped to last 10 messages)
    const rawHistory: unknown[] = Array.isArray(req.body?.history) ? req.body.history : [];
    const history: ChatHistoryMessage[] = rawHistory
      .slice(-10)
      .filter(
        (item): item is ChatHistoryMessage =>
          typeof item === 'object' &&
          item !== null &&
          (((item as any).role === 'user') || ((item as any).role === 'assistant')) &&
          typeof (item as any).content === 'string',
      );

    const result = await getEcoGuideReply(message, history, req.auth!.userId);

    return res.json(result);
  }),
);

export { experienceRoutes };
