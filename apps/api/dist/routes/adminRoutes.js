"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminRoutes = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const prismaClient_1 = require("../prismaClient");
const authentication_1 = require("../http/authentication");
const errorResponder_1 = require("../http/errorResponder");
const GamificationService_1 = require("../services/GamificationService");
const adminRoutes = (0, express_1.Router)();
exports.adminRoutes = adminRoutes;
const gamificationService = new GamificationService_1.GamificationService();
const lessonSchema = zod_1.z.object({
    title: zod_1.z.string().min(3),
    summary: zod_1.z.string().min(10),
    content: zod_1.z.string().min(20),
    category: zod_1.z.string().min(3),
    imageUrl: zod_1.z.string().url().optional().or(zod_1.z.literal('')),
    durationMinutes: zod_1.z.number().int().min(1).max(120),
    rating: zod_1.z.number().min(1).max(5),
    pointsReward: zod_1.z.number().int().min(1).max(200),
    featured: zod_1.z.boolean(),
});
const challengeSchema = zod_1.z.object({
    title: zod_1.z.string().min(3),
    description: zod_1.z.string().min(10),
    difficulty: zod_1.z.enum(['EASY', 'MEDIUM', 'HARD']),
    category: zod_1.z.string().optional(),
    durationDays: zod_1.z.number().int().min(1).max(60),
    pointsReward: zod_1.z.number().int().min(1).max(300),
    imageUrl: zod_1.z.string().url().optional().or(zod_1.z.literal('')),
    badgeLabel: zod_1.z.string().optional(),
    active: zod_1.z.boolean(),
});
const eventSchema = zod_1.z.object({
    title: zod_1.z.string().min(3),
    description: zod_1.z.string().min(10),
    location: zod_1.z.string().min(3),
    date: zod_1.z.string(),
    capacity: zod_1.z.number().int().min(1).max(5000),
    pointsReward: zod_1.z.number().int().min(1).max(300),
    imageUrl: zod_1.z.string().url().optional().or(zod_1.z.literal('')),
    latitude: zod_1.z.number().optional(),
    longitude: zod_1.z.number().optional(),
});
adminRoutes.use(authentication_1.authenticateRequest, (0, authentication_1.requireRoles)('ADMIN', 'MODERATOR'));
adminRoutes.get('/dashboard', (0, errorResponder_1.errorBoundary)(async (_req, res) => {
    const [users, lessons, challenges, events, logs] = await Promise.all([
        prismaClient_1.prisma.user.count(),
        prismaClient_1.prisma.lesson.count(),
        prismaClient_1.prisma.challenge.count({ where: { active: true } }),
        prismaClient_1.prisma.event.count(),
        prismaClient_1.prisma.transparencyLog.count(),
    ]);
    return res.json({
        totals: { users, lessons, challenges, events, logs },
    });
}));
adminRoutes.get('/users', (0, errorResponder_1.errorBoundary)(async (_req, res) => {
    const users = await prismaClient_1.prisma.user.findMany({
        include: { profile: true },
        orderBy: [{ points: 'desc' }, { createdAt: 'asc' }],
    });
    return res.json({ items: users });
}));
adminRoutes.get('/lessons', (0, errorResponder_1.errorBoundary)(async (_req, res) => res.json({ items: await prismaClient_1.prisma.lesson.findMany({ orderBy: { title: 'asc' } }) })));
adminRoutes.post('/lessons', (0, errorResponder_1.errorBoundary)(async (req, res) => res.status(201).json({ item: await prismaClient_1.prisma.lesson.create({ data: lessonSchema.parse(req.body) }) })));
adminRoutes.put('/lessons/:lessonId', (0, errorResponder_1.errorBoundary)(async (req, res) => res.json({ item: await prismaClient_1.prisma.lesson.update({ where: { id: req.params.lessonId }, data: lessonSchema.parse(req.body) }) })));
adminRoutes.delete('/lessons/:lessonId', (0, errorResponder_1.errorBoundary)(async (req, res) => res.json({ deleted: await prismaClient_1.prisma.lesson.delete({ where: { id: req.params.lessonId } }) })));
adminRoutes.get('/challenges', (0, errorResponder_1.errorBoundary)(async (_req, res) => res.json({ items: await prismaClient_1.prisma.challenge.findMany({ orderBy: { title: 'asc' } }) })));
adminRoutes.post('/challenges', (0, errorResponder_1.errorBoundary)(async (req, res) => res.status(201).json({ item: await prismaClient_1.prisma.challenge.create({ data: challengeSchema.parse(req.body) }) })));
adminRoutes.put('/challenges/:challengeId', (0, errorResponder_1.errorBoundary)(async (req, res) => res.json({ item: await prismaClient_1.prisma.challenge.update({ where: { id: req.params.challengeId }, data: challengeSchema.parse(req.body) }) })));
adminRoutes.delete('/challenges/:challengeId', (0, errorResponder_1.errorBoundary)(async (req, res) => res.json({ deleted: await prismaClient_1.prisma.challenge.delete({ where: { id: req.params.challengeId } }) })));
adminRoutes.get('/events', (0, errorResponder_1.errorBoundary)(async (_req, res) => {
    const items = await prismaClient_1.prisma.event.findMany({
        include: {
            registrations: {
                include: { user: { include: { profile: true } } },
            },
        },
        orderBy: { date: 'asc' },
    });
    return res.json({ items });
}));
adminRoutes.post('/events', (0, errorResponder_1.errorBoundary)(async (req, res) => {
    const payload = eventSchema.parse(req.body);
    const item = await prismaClient_1.prisma.event.create({
        data: {
            ...payload,
            date: new Date(payload.date),
            adminId: req.auth.userId,
        },
    });
    return res.status(201).json({ item });
}));
adminRoutes.put('/events/:eventId', (0, errorResponder_1.errorBoundary)(async (req, res) => {
    const payload = eventSchema.parse(req.body);
    const item = await prismaClient_1.prisma.event.update({
        where: { id: req.params.eventId },
        data: {
            ...payload,
            date: new Date(payload.date),
        },
    });
    return res.json({ item });
}));
adminRoutes.delete('/events/:eventId', (0, errorResponder_1.errorBoundary)(async (req, res) => res.json({ deleted: await prismaClient_1.prisma.event.delete({ where: { id: req.params.eventId } }) })));
adminRoutes.post('/events/:eventId/registrations/:registrationId/attend', (0, errorResponder_1.errorBoundary)(async (req, res) => {
    const result = await gamificationService.markEventAttendance(req.auth.userId, req.params.eventId, req.params.registrationId);
    return res.json(result);
}));
