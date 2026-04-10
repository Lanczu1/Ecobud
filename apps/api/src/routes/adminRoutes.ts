import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../prismaClient';
import { authenticateRequest, requireRoles, AuthenticatedRequest } from '../http/authentication';
import { errorBoundary } from '../http/errorResponder';
import { GamificationService } from '../services/GamificationService';

const adminRoutes = Router();
const gamificationService = new GamificationService();

const lessonSchema = z.object({
  title: z.string().min(3),
  summary: z.string().min(10),
  content: z.string().min(20),
  category: z.string().min(3),
  imageUrl: z.string().url().optional().or(z.literal('')),
  durationMinutes: z.number().int().min(1).max(120),
  rating: z.number().min(1).max(5),
  pointsReward: z.number().int().min(1).max(200),
  featured: z.boolean(),
});

const challengeSchema = z.object({
  title: z.string().min(3),
  description: z.string().min(10),
  difficulty: z.enum(['EASY', 'MEDIUM', 'HARD']),
  category: z.string().optional(),
  durationDays: z.number().int().min(1).max(60),
  pointsReward: z.number().int().min(1).max(300),
  imageUrl: z.string().url().optional().or(z.literal('')),
  badgeLabel: z.string().optional(),
  active: z.boolean(),
});

const eventSchema = z.object({
  title: z.string().min(3),
  description: z.string().min(10),
  location: z.string().min(3),
  date: z.string(),
  capacity: z.number().int().min(1).max(5000),
  pointsReward: z.number().int().min(1).max(300),
  imageUrl: z.string().url().optional().or(z.literal('')),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
});

adminRoutes.use(authenticateRequest, requireRoles('ADMIN', 'MODERATOR'));

adminRoutes.get(
  '/dashboard',
  errorBoundary(async (_req, res) => {
    const [users, lessons, challenges, events, logs] = await Promise.all([
      prisma.user.count(),
      prisma.lesson.count(),
      prisma.challenge.count({ where: { active: true } }),
      prisma.event.count(),
      prisma.transparencyLog.count(),
    ]);

    return res.json({
      totals: { users, lessons, challenges, events, logs },
    });
  }),
);

adminRoutes.get(
  '/users',
  errorBoundary(async (_req, res) => {
    const users = await prisma.user.findMany({
      include: { profile: true },
      orderBy: [{ points: 'desc' }, { createdAt: 'asc' }],
    });

    return res.json({ items: users });
  }),
);

adminRoutes.get('/lessons', errorBoundary(async (_req, res) => res.json({ items: await prisma.lesson.findMany({ orderBy: { title: 'asc' } }) })));
adminRoutes.post('/lessons', errorBoundary(async (req, res) => res.status(201).json({ item: await prisma.lesson.create({ data: lessonSchema.parse(req.body) }) })));
adminRoutes.put('/lessons/:lessonId', errorBoundary(async (req, res) => res.json({ item: await prisma.lesson.update({ where: { id: req.params.lessonId }, data: lessonSchema.parse(req.body) }) })));
adminRoutes.delete('/lessons/:lessonId', errorBoundary(async (req, res) => res.json({ deleted: await prisma.lesson.delete({ where: { id: req.params.lessonId } }) })));

adminRoutes.get('/challenges', errorBoundary(async (_req, res) => res.json({ items: await prisma.challenge.findMany({ orderBy: { title: 'asc' } }) })));
adminRoutes.post('/challenges', errorBoundary(async (req, res) => res.status(201).json({ item: await prisma.challenge.create({ data: challengeSchema.parse(req.body) }) })));
adminRoutes.put('/challenges/:challengeId', errorBoundary(async (req, res) => res.json({ item: await prisma.challenge.update({ where: { id: req.params.challengeId }, data: challengeSchema.parse(req.body) }) })));
adminRoutes.delete('/challenges/:challengeId', errorBoundary(async (req, res) => res.json({ deleted: await prisma.challenge.delete({ where: { id: req.params.challengeId } }) })));

adminRoutes.get(
  '/events',
  errorBoundary(async (_req, res) => {
    const items = await prisma.event.findMany({
      include: {
        registrations: {
          include: { user: { include: { profile: true } } },
        },
      },
      orderBy: { date: 'asc' },
    });

    return res.json({ items });
  }),
);

adminRoutes.post(
  '/events',
  errorBoundary(async (req: AuthenticatedRequest, res) => {
    const payload = eventSchema.parse(req.body);
    const item = await prisma.event.create({
      data: {
        ...payload,
        date: new Date(payload.date),
        adminId: req.auth!.userId,
      },
    });

    return res.status(201).json({ item });
  }),
);

adminRoutes.put(
  '/events/:eventId',
  errorBoundary(async (req, res) => {
    const payload = eventSchema.parse(req.body);
    const item = await prisma.event.update({
      where: { id: req.params.eventId },
      data: {
        ...payload,
        date: new Date(payload.date),
      },
    });

    return res.json({ item });
  }),
);

adminRoutes.delete('/events/:eventId', errorBoundary(async (req, res) => res.json({ deleted: await prisma.event.delete({ where: { id: req.params.eventId } }) })));

adminRoutes.post(
  '/events/:eventId/registrations/:registrationId/attend',
  errorBoundary(async (req: AuthenticatedRequest, res) => {
    const result = await gamificationService.markEventAttendance(
      req.auth!.userId,
      req.params.eventId,
      req.params.registrationId,
    );

    return res.json(result);
  }),
);

export { adminRoutes };
