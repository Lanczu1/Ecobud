import { Router } from 'express';
import { prisma } from '../prismaClient';
import { authenticateRequest, AuthenticatedRequest, requireUserAccess } from '../http/authentication';
import { errorBoundary } from '../http/errorResponder';
import { GamificationService } from '../services/GamificationService';

const lessonRoutes = Router();
const gamificationService = new GamificationService();

lessonRoutes.get(
  '/',
  authenticateRequest,
  requireUserAccess,
  errorBoundary(async (req: AuthenticatedRequest, res) => {
    const search = typeof req.query.search === 'string' ? req.query.search : undefined;
    const featuredOnly = req.query.featured === 'true';

    const lessons = await prisma.lesson.findMany({
      where: {
        featured: featuredOnly ? true : undefined,
        OR: search
          ? [
              { title: { contains: search } },
              { category: { contains: search } },
              { description: { contains: search } },
            ]
          : undefined,
      },
      orderBy: [{ featured: 'desc' }, { title: 'asc' }],
      include: {
        progress: {
          where: { userId: req.auth!.userId },
          take: 1,
        },
      },
    });

    return res.json({
      items: lessons.map((lesson) => ({
        ...lesson,
        progress: lesson.progress[0] ?? null,
      })),
    });
  }),
);

lessonRoutes.get(
  '/:lessonId',
  authenticateRequest,
  requireUserAccess,
  errorBoundary(async (req: AuthenticatedRequest, res) => {
    const lesson = await prisma.lesson.findUnique({
      where: { id: req.params.lessonId },
      include: {
        progress: {
          where: { userId: req.auth!.userId },
          take: 1,
        },
      },
    });

    return res.json({ item: lesson });
  }),
);

lessonRoutes.post(
  '/:lessonId/complete',
  authenticateRequest,
  requireUserAccess,
  errorBoundary(async (req: AuthenticatedRequest, res) => {
    const result = await gamificationService.completeLesson(req.auth!.userId, req.params.lessonId);
    return res.json(result);
  }),
);

export { lessonRoutes };
