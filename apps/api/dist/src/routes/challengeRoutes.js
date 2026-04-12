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
const submissionSchema = zod_1.z
    .object({
    proofText: zod_1.z.string().min(10).max(1000).optional(),
    proofUrl: zod_1.z.string().url().optional(),
})
    .refine((payload) => Boolean(payload.proofText ?? payload.proofUrl), {
    message: 'Provide proof text or a proof URL.',
    path: ['proofText'],
});
challengeRoutes.get('/active', authentication_1.authenticateRequest, authentication_1.requireUserAccess, (0, errorResponder_1.errorBoundary)(async (req, res) => {
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
challengeRoutes.post('/:challengeId/progress', authentication_1.authenticateRequest, authentication_1.requireUserAccess, (0, errorResponder_1.errorBoundary)(async (req, res) => {
    const payload = progressSchema.parse(req.body);
    const result = await gamificationService.updateChallengeProgress(req.auth.userId, req.params.challengeId, payload.progressPercentage);
    return res.json(result);
}));
challengeRoutes.get('/submissions/mine', authentication_1.authenticateRequest, authentication_1.requireUserAccess, (0, errorResponder_1.errorBoundary)(async (req, res) => {
    const items = await prismaClient_1.prisma.challengeSubmission.findMany({
        where: { userId: req.auth.userId },
        include: {
            challenge: true,
            reviewer: {
                include: {
                    profile: true,
                },
            },
        },
        orderBy: { updatedAt: 'desc' },
    });
    return res.json({ items });
}));
challengeRoutes.post('/:challengeId/submissions', authentication_1.authenticateRequest, authentication_1.requireUserAccess, (0, errorResponder_1.errorBoundary)(async (req, res) => {
    const payload = submissionSchema.parse(req.body);
    const challenge = await prismaClient_1.prisma.challenge.findUnique({
        where: { id: req.params.challengeId },
        select: {
            id: true,
            active: true,
        },
    });
    if (!challenge || !challenge.active) {
        throw new errorResponder_1.HttpError(404, 'Active challenge not found.');
    }
    const submission = await prismaClient_1.prisma.challengeSubmission.upsert({
        where: {
            userId_challengeId: {
                userId: req.auth.userId,
                challengeId: challenge.id,
            },
        },
        update: {
            proofText: payload.proofText,
            proofUrl: payload.proofUrl,
            status: 'pending',
            moderatorNotes: null,
            flaggedReason: null,
            reviewedById: null,
            reviewedAt: null,
        },
        create: {
            userId: req.auth.userId,
            challengeId: challenge.id,
            proofText: payload.proofText,
            proofUrl: payload.proofUrl,
        },
    });
    return res.status(201).json({ submission });
}));
challengeRoutes.get('/streaks/summary', authentication_1.authenticateRequest, authentication_1.requireUserAccess, (0, errorResponder_1.errorBoundary)(async (req, res) => {
    const user = await prismaClient_1.prisma.user.findUnique({
        where: { id: req.auth.userId },
        select: {
            currentStreak: true,
            lastActionDate: true,
        },
    });
    return res.json({
        currentStreak: user?.currentStreak ?? 0,
        lastActionDate: user?.lastActionDate ?? null,
    });
}));
