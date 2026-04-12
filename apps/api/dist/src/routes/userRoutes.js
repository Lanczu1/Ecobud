"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.userRoutes = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const prismaClient_1 = require("../prismaClient");
const authentication_1 = require("../http/authentication");
const errorResponder_1 = require("../http/errorResponder");
const userRoutes = (0, express_1.Router)();
exports.userRoutes = userRoutes;
const preferenceSchema = zod_1.z.object({
    displayName: zod_1.z.string().min(2).max(50).optional(),
    headline: zod_1.z.string().max(120).optional(),
    city: zod_1.z.string().max(80).optional(),
    preferences: zod_1.z.record(zod_1.z.string(), zod_1.z.union([zod_1.z.string(), zod_1.z.boolean(), zod_1.z.number()])).optional(),
});
userRoutes.get('/me', authentication_1.authenticateRequest, authentication_1.requireUserAccess, (0, errorResponder_1.errorBoundary)(async (req, res) => {
    const user = await prismaClient_1.prisma.user.findUnique({
        where: { id: req.auth.userId },
        include: {
            profile: true,
            badges: {
                include: { badge: true },
                orderBy: { unlockedAt: 'asc' },
            },
            eventRegistrations: {
                include: { event: true },
                orderBy: { registeredAt: 'desc' },
            },
            lessonProgress: true,
            challengeProgress: true,
        },
    });
    const recentLogs = await prismaClient_1.prisma.transparencyLog.findMany({
        where: { userId: req.auth.userId },
        orderBy: { timestamp: 'desc' },
        take: 5,
    });
    return res.json({
        id: user?.id,
        name: user?.name,
        email: user?.email,
        role: user?.role,
        status: user?.status,
        points: user?.points ?? 0,
        currentStreak: user?.currentStreak ?? 0,
        profile: user?.profile,
        badges: user?.badges.map((item) => item.badge) ?? [],
        eventHistory: user?.eventRegistrations.map((item) => ({
            ...item.event,
            status: item.status,
            attendedAt: item.attendedAt,
        })) ?? [],
        progress: {
            lessonsCompleted: user?.lessonProgress.filter((item) => item.status === 'completed').length ?? 0,
            activeChallenges: user?.challengeProgress.filter((item) => item.status !== 'COMPLETED').length ?? 0,
        },
        recentLogs,
    });
}));
userRoutes.patch('/me/preferences', authentication_1.authenticateRequest, authentication_1.requireUserAccess, (0, errorResponder_1.errorBoundary)(async (req, res) => {
    const payload = preferenceSchema.parse(req.body);
    const result = await prismaClient_1.prisma.$transaction(async (tx) => {
        if (payload.displayName) {
            await tx.user.update({
                where: { id: req.auth.userId },
                data: {
                    name: payload.displayName,
                },
            });
        }
        const profile = await tx.profile.upsert({
            where: { userId: req.auth.userId },
            update: {
                displayName: payload.displayName,
                headline: payload.headline,
                city: payload.city,
                preferencesJson: payload.preferences ? JSON.stringify(payload.preferences) : undefined,
            },
            create: {
                userId: req.auth.userId,
                displayName: payload.displayName ?? req.auth.name,
                headline: payload.headline,
                city: payload.city,
                preferencesJson: payload.preferences ? JSON.stringify(payload.preferences) : undefined,
            },
        });
        const user = await tx.user.findUnique({
            where: { id: req.auth.userId },
            select: {
                name: true,
            },
        });
        return {
            profile,
            name: user?.name ?? req.auth.name,
        };
    });
    return res.json(result);
}));
