"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.experienceRoutes = void 0;
const express_1 = require("express");
const prismaClient_1 = require("../prismaClient");
const authentication_1 = require("../http/authentication");
const errorResponder_1 = require("../http/errorResponder");
const experienceRoutes = (0, express_1.Router)();
exports.experienceRoutes = experienceRoutes;
const getDateKey = (date = new Date()) => date.toISOString().slice(0, 10);
const buildAssistantReply = (message) => {
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
experienceRoutes.get('/dashboard', authentication_1.authenticateRequest, (0, errorResponder_1.errorBoundary)(async (req, res) => {
    const userId = req.auth.userId;
    const today = getDateKey();
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
    const [user, activeChallenges, featuredLessons, upcomingEvents, habits, recentCheckIns] = await Promise.all([
        prismaClient_1.prisma.user.findUnique({
            where: { id: userId },
            include: { profile: true },
        }),
        prismaClient_1.prisma.challenge.findMany({
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
        prismaClient_1.prisma.lesson.findMany({
            where: { featured: true },
            orderBy: { title: 'asc' },
            take: 3,
        }),
        prismaClient_1.prisma.eventRegistration.findMany({
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
        prismaClient_1.prisma.habit.findMany({
            where: { active: true },
            orderBy: { title: 'asc' },
        }),
        prismaClient_1.prisma.habitCheckIn.findMany({
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
            displayName: user?.profile?.displayName ?? 'Eco Explorer',
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
}));
experienceRoutes.get('/tracker', authentication_1.authenticateRequest, (0, errorResponder_1.errorBoundary)(async (req, res) => {
    const userId = req.auth.userId;
    const month = typeof req.query.month === 'string' ? req.query.month : getDateKey().slice(0, 7);
    const [habits, checkIns, user] = await Promise.all([
        prismaClient_1.prisma.habit.findMany({ where: { active: true }, orderBy: { title: 'asc' } }),
        prismaClient_1.prisma.habitCheckIn.findMany({
            where: {
                userId,
                dateKey: {
                    startsWith: month,
                },
            },
        }),
        prismaClient_1.prisma.user.findUnique({
            where: { id: userId },
            select: {
                currentStreak: true,
            },
        }),
    ]);
    const today = getDateKey();
    const todaysHabitIds = new Set(checkIns.filter((item) => item.dateKey === today).map((item) => item.habitId));
    const uniqueDays = new Set(checkIns.map((item) => item.dateKey));
    return res.json({
        month,
        currentStreak: user?.currentStreak ?? 0,
        weeklyGoalProgress: Math.min(100, Math.round((uniqueDays.size / 7) * 100)),
        completedDays: [...uniqueDays],
        todayHabits: habits.map((habit) => ({
            ...habit,
            completedToday: todaysHabitIds.has(habit.id),
        })),
    });
}));
experienceRoutes.get('/leaderboard', authentication_1.authenticateRequest, (0, errorResponder_1.errorBoundary)(async (req, res) => {
    const currentUserId = req.auth.userId;
    const users = await prismaClient_1.prisma.user.findMany({
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
            displayName: user.profile?.displayName ?? user.email,
            points: user.points,
            badges: user.badges.slice(0, 3).map((item) => item.badge.name),
            isCurrentUser: user.id === currentUserId,
        })),
        currentUserRank: currentUserIndex >= 0 ? currentUserIndex + 1 : null,
    });
}));
experienceRoutes.get('/rewards', authentication_1.authenticateRequest, (0, errorResponder_1.errorBoundary)(async (req, res) => {
    const userId = req.auth.userId;
    const [user, badges, userBadges, challengeCount, eventCount] = await Promise.all([
        prismaClient_1.prisma.user.findUnique({
            where: { id: userId },
            select: { points: true },
        }),
        prismaClient_1.prisma.badge.findMany({ orderBy: { requiredPoints: 'asc' } }),
        prismaClient_1.prisma.userBadge.findMany({
            where: { userId },
        }),
        prismaClient_1.prisma.userChallenge.count({
            where: {
                userId,
                status: 'COMPLETED',
            },
        }),
        prismaClient_1.prisma.eventRegistration.count({
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
}));
experienceRoutes.post('/assistant/chat', authentication_1.authenticateRequest, (0, errorResponder_1.errorBoundary)(async (req, res) => {
    const message = typeof req.body?.message === 'string' ? req.body.message : '';
    return res.json({
        reply: buildAssistantReply(message),
        quickReplies: ['How to compost?', 'Where is the next event?', 'My Eco Points', 'Find a challenge'],
    });
}));
