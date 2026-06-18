import { Router } from 'express';
import { prisma } from '../prismaClient';
import { authenticateRequest, AuthenticatedRequest, requireUserAccess } from '../http/authentication';
import { errorBoundary } from '../http/errorResponder';

const experienceRoutes = Router();

const getDateKey = (date = new Date()) => date.toISOString().slice(0, 10);

const buildAssistantReply = (message: string) => {
  const normalized = message.toLowerCase();

  if (normalized.includes('compost')) {
    return 'Start composting with fruit scraps, vegetable peels, dry leaves, and a breathable bin. Keep the mix balanced between green and brown materials.';
  }

  if (normalized.includes('event')) {
    return 'You can join upcoming ECOBUD community events from the Events section. Tree planting and clean-up drives are both available this month.';
  }

  if (normalized.includes('points')) {
    return 'You earn ECO Points by finishing lessons, completing challenges, checking in daily habits, and attending verified events.';
  }

  return 'I can help with composting, local eco events, challenges, eco points, and sustainable living tips. Ask me anything green.';
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
        currentStreak: user?.currentStreak ?? 0,
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
    const [habits, checkIns, user] = await Promise.all([
      prisma.habit.findMany({ where: { active: true }, orderBy: { title: 'asc' } }),
      prisma.habitCheckIn.findMany({
        where: {
          userId,
          dateKey: {
            startsWith: month,
          },
        },
      }),
      prisma.user.findUnique({
        where: { id: userId },
        select: {
          currentStreak: true,
          points: true,
        },
      }),
    ]);

    const today = getDateKey();
    const todaysHabitIds = new Set(
      checkIns.filter((item) => item.dateKey === today).map((item) => item.habitId),
    );
    const uniqueDays = new Set(checkIns.map((item) => item.dateKey));

    return res.json({
      month,
      currentStreak: user?.currentStreak ?? 0,
      points: user?.points ?? 0,
      weeklyGoalProgress: Math.min(100, Math.round((uniqueDays.size / 7) * 100)),
      completedDays: [...uniqueDays],
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
      take: 50,
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
  errorBoundary(async (req: AuthenticatedRequest, res) => {
    const message = typeof req.body?.message === 'string' ? req.body.message : '';

    return res.json({
      reply: buildAssistantReply(message),
      quickReplies: ['How to compost?', 'Where is the next event?', 'My Eco Points', 'Find a challenge'],
    });
  }),
);

export { experienceRoutes };
