"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.moderationRoutes = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const prismaClient_1 = require("../prismaClient");
const authentication_1 = require("../http/authentication");
const errorResponder_1 = require("../http/errorResponder");
const GamificationService_1 = require("../services/GamificationService");
const moderationRoutes = (0, express_1.Router)();
exports.moderationRoutes = moderationRoutes;
const gamificationService = new GamificationService_1.GamificationService();
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
const moderationDecisionSchema = zod_1.z.object({
    moderatorNotes: zod_1.z.string().max(500).optional(),
});
const submissionStatusFilterSchema = zod_1.z
    .enum(['pending', 'approved', 'rejected', 'flagged'])
    .optional();
const flagSchema = zod_1.z.object({
    reason: zod_1.z.string().min(5).max(300),
    moderatorNotes: zod_1.z.string().max(500).optional(),
});
const updateSubmissionStatus = async (submissionId, reviewerId, status, options) => {
    const submission = await prismaClient_1.prisma.challengeSubmission.findUnique({
        where: { id: submissionId },
    });
    if (!submission) {
        throw new errorResponder_1.HttpError(404, 'Challenge submission not found.');
    }
    return prismaClient_1.prisma.challengeSubmission.update({
        where: { id: submissionId },
        data: {
            status,
            moderatorNotes: options?.moderatorNotes,
            flaggedReason: options?.flaggedReason ?? null,
            reviewedById: reviewerId,
            reviewedAt: new Date(),
        },
        include: {
            challenge: true,
            user: {
                include: {
                    profile: true,
                },
            },
            reviewer: {
                include: {
                    profile: true,
                },
            },
        },
    });
};
moderationRoutes.use(authentication_1.authenticateRequest, authentication_1.requireModeratorAccess);
moderationRoutes.get('/dashboard', (0, errorResponder_1.errorBoundary)(async (_req, res) => {
    const [pendingSubmissions, flaggedSubmissions, managedEvents, pendingAttendance] = await Promise.all([
        prismaClient_1.prisma.challengeSubmission.count({ where: { status: 'pending' } }),
        prismaClient_1.prisma.challengeSubmission.count({ where: { status: 'flagged' } }),
        prismaClient_1.prisma.event.count(),
        prismaClient_1.prisma.eventRegistration.count({ where: { status: 'REGISTERED' } }),
    ]);
    return res.json({
        totals: {
            pendingSubmissions,
            flaggedSubmissions,
            managedEvents,
            pendingAttendance,
        },
    });
}));
moderationRoutes.get('/events', (0, errorResponder_1.errorBoundary)(async (_req, res) => {
    const items = await prismaClient_1.prisma.event.findMany({
        include: {
            managedBy: {
                include: {
                    profile: true,
                },
            },
            registrations: {
                include: {
                    user: {
                        include: {
                            profile: true,
                        },
                    },
                },
            },
        },
        orderBy: { date: 'asc' },
    });
    return res.json({ items });
}));
moderationRoutes.post('/events', (0, errorResponder_1.errorBoundary)(async (req, res) => {
    const payload = eventSchema.parse(req.body);
    const item = await prismaClient_1.prisma.event.create({
        data: {
            ...payload,
            date: new Date(payload.date),
            managedById: req.auth.userId,
        },
    });
    return res.status(201).json({ item });
}));
moderationRoutes.put('/events/:eventId', (0, errorResponder_1.errorBoundary)(async (req, res) => {
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
moderationRoutes.delete('/events/:eventId', (0, errorResponder_1.errorBoundary)(async (req, res) => res.json({ deleted: await prismaClient_1.prisma.event.delete({ where: { id: req.params.eventId } }) })));
moderationRoutes.post('/events/:eventId/registrations/:registrationId/attend', (0, errorResponder_1.errorBoundary)(async (req, res) => {
    const result = await gamificationService.markEventAttendance(req.params.eventId, req.params.registrationId);
    return res.json(result);
}));
moderationRoutes.get('/challenge-submissions', (0, errorResponder_1.errorBoundary)(async (req, res) => {
    const status = submissionStatusFilterSchema.parse(typeof req.query.status === 'string' ? req.query.status : undefined);
    const items = await prismaClient_1.prisma.challengeSubmission.findMany({
        where: {
            status,
        },
        include: {
            challenge: true,
            user: {
                include: {
                    profile: true,
                },
            },
            reviewer: {
                include: {
                    profile: true,
                },
            },
        },
        orderBy: [{ updatedAt: 'desc' }],
    });
    return res.json({ items });
}));
moderationRoutes.post('/challenge-submissions/:submissionId/approve', (0, errorResponder_1.errorBoundary)(async (req, res) => {
    const payload = moderationDecisionSchema.parse(req.body);
    const item = await updateSubmissionStatus(req.params.submissionId, req.auth.userId, 'approved', {
        moderatorNotes: payload.moderatorNotes,
    });
    return res.json({ item });
}));
moderationRoutes.post('/challenge-submissions/:submissionId/reject', (0, errorResponder_1.errorBoundary)(async (req, res) => {
    const payload = moderationDecisionSchema.parse(req.body);
    const item = await updateSubmissionStatus(req.params.submissionId, req.auth.userId, 'rejected', {
        moderatorNotes: payload.moderatorNotes,
    });
    return res.json({ item });
}));
moderationRoutes.post('/challenge-submissions/:submissionId/flag', (0, errorResponder_1.errorBoundary)(async (req, res) => {
    const payload = flagSchema.parse(req.body);
    const item = await updateSubmissionStatus(req.params.submissionId, req.auth.userId, 'flagged', {
        flaggedReason: payload.reason,
        moderatorNotes: payload.moderatorNotes,
    });
    return res.json({ item });
}));
