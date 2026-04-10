"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.challengeRoutes = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const prismaClient_1 = require("../prismaClient");
const authentication_1 = require("../http/authentication");
const errorResponder_1 = require("../http/errorResponder");
const GamificationService_1 = require("../services/GamificationService");
const challengeRoutes = (0, express_1.Router)();
exports.challengeRoutes = challengeRoutes;
const gamificationService = new GamificationService_1.GamificationService();
const progressSchema = zod_1.z.object({
    progressPercentage: zod_1.z.number().int().min(0).max(100),
});
challengeRoutes.get('/active', authentication_1.authenticateRequest, (0, errorResponder_1.errorBoundary)(async (req, res) => {
    const userId = req.auth.userId;
    const challenges = await prismaClient_1.prisma.challenge.findMany({
        where: { active: true },
        include: {
            userChallenges: {
                where: { userId },
                take: 1,
            },
        },
        orderBy: [{ difficulty: 'asc' }, { title: 'asc' }],
    });
    return res.json({
        items: challenges.map((challenge) => ({
            ...challenge,
            progress: challenge.userChallenges[0] ?? null,
        })),
    });
}));
challengeRoutes.post('/:challengeId/progress', authentication_1.authenticateRequest, (0, errorResponder_1.errorBoundary)(async (req, res) => {
    const payload = progressSchema.parse(req.body);
    const result = await gamificationService.updateChallengeProgress(req.auth.userId, req.params.challengeId, payload.progressPercentage);
    return res.json(result);
}));
challengeRoutes.get('/streaks/summary', authentication_1.authenticateRequest, (0, errorResponder_1.errorBoundary)(async (req, res) => {
    const user = await prismaClient_1.prisma.user.findUnique({
        where: { id: req.auth.userId },
        select: {
            currentStreak: true,
            highestStreak: true,
            lastActionDate: true,
        },
    });
    return res.json({
        currentStreak: user?.currentStreak ?? 0,
        highestStreak: user?.highestStreak ?? 0,
        lastActionDate: user?.lastActionDate ?? null,
    });
}));
