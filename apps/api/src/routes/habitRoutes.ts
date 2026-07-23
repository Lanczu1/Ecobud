import { Router } from 'express';
import { prisma } from '../prismaClient';
import { authenticateRequest, AuthenticatedRequest, requireUserAccess } from '../http/authentication';
import { errorBoundary } from '../http/errorResponder';
import { GamificationService } from '../services/GamificationService';

const habitRoutes = Router();
const gamificationService = new GamificationService();

const getDateKey = (date = new Date()) => {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
};

habitRoutes.get(
  '/today',
  authenticateRequest,
  requireUserAccess,
  errorBoundary(async (req: AuthenticatedRequest, res) => {
    const userId = req.auth!.userId;
    const dateKey = getDateKey();
    const [habits, checkIns] = await Promise.all([
      prisma.habit.findMany({
        where: { active: true },
        orderBy: { title: 'asc' },
      }),
      prisma.habitCheckIn.findMany({
        where: {
          userId,
          dateKey,
        },
      }),
    ]);

    const completedIds = new Set(checkIns.map((item) => item.habitId));

    return res.json({
      dateKey,
      items: habits.map((habit) => ({
        ...habit,
        completedToday: completedIds.has(habit.id),
      })),
      pointsEarnedToday: checkIns.reduce((sum, item) => sum + item.pointsAwarded, 0),
    });
  }),
);

habitRoutes.post(
  '/:habitId/check-in',
  authenticateRequest,
  requireUserAccess,
  errorBoundary(async (req: AuthenticatedRequest, res) => {
    const result = await gamificationService.checkInHabit(
      req.auth!.userId,
      req.params.habitId,
      getDateKey(),
    );

    return res.json(result);
  }),
);

export { habitRoutes };
