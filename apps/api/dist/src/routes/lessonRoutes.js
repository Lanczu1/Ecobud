"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.lessonRoutes = void 0;
const express_1 = require("express");
const prismaClient_1 = require("../prismaClient");
const authentication_1 = require("../http/authentication");
const errorResponder_1 = require("../http/errorResponder");
const GamificationService_1 = require("../services/GamificationService");
const lessonRoutes = (0, express_1.Router)();
exports.lessonRoutes = lessonRoutes;
const gamificationService = new GamificationService_1.GamificationService();
lessonRoutes.get('/', authentication_1.authenticateRequest, authentication_1.requireUserAccess, (0, errorResponder_1.errorBoundary)(async (req, res) => {
    const search = typeof req.query.search === 'string' ? req.query.search : undefined;
    const featuredOnly = req.query.featured === 'true';
    const lessons = await prismaClient_1.prisma.lesson.findMany({
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
                where: { userId: req.auth.userId },
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
}));
lessonRoutes.get('/:lessonId', authentication_1.authenticateRequest, authentication_1.requireUserAccess, (0, errorResponder_1.errorBoundary)(async (req, res) => {
    const lesson = await prismaClient_1.prisma.lesson.findUnique({
        where: { id: req.params.lessonId },
        include: {
            progress: {
                where: { userId: req.auth.userId },
                take: 1,
            },
        },
    });
    return res.json({ item: lesson });
}));
lessonRoutes.post('/:lessonId/complete', authentication_1.authenticateRequest, authentication_1.requireUserAccess, (0, errorResponder_1.errorBoundary)(async (req, res) => {
    const result = await gamificationService.completeLesson(req.auth.userId, req.params.lessonId);
    return res.json(result);
}));
