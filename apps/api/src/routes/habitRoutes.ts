import { Router } from 'express';
import { prisma } from '../prismaClient';
import { authenticateRequest, AuthenticatedRequest } from '../http/authentication';
import { errorBoundary } from '../http/errorResponder';
import { GamificationService } from '../services/GamificationService';

const habitRoutes = Router();
const gamificationService = new GamificationService();

const getDateKey = (date = new Date()) => date.toISOString().slice(0, 10);

habitRoutes.get(
  '/today',
  authenticateRequest,
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
