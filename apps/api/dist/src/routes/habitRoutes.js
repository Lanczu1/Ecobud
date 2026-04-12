"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.habitRoutes = void 0;
const express_1 = require("express");
const prismaClient_1 = require("../prismaClient");
const authentication_1 = require("../http/authentication");
const errorResponder_1 = require("../http/errorResponder");
const GamificationService_1 = require("../services/GamificationService");
const habitRoutes = (0, express_1.Router)();
exports.habitRoutes = habitRoutes;
const gamificationService = new GamificationService_1.GamificationService();
const getDateKey = (date = new Date()) => date.toISOString().slice(0, 10);
habitRoutes.get('/today', authentication_1.authenticateRequest, authentication_1.requireUserAccess, (0, errorResponder_1.errorBoundary)(async (req, res) => {
    const userId = req.auth.userId;
    const dateKey = getDateKey();
    const [habits, checkIns] = await Promise.all([
        prismaClient_1.prisma.habit.findMany({
            where: { active: true },
            orderBy: { title: 'asc' },
        }),
        prismaClient_1.prisma.habitCheckIn.findMany({
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
}));
habitRoutes.post('/:habitId/check-in', authentication_1.authenticateRequest, authentication_1.requireUserAccess, (0, errorResponder_1.errorBoundary)(async (req, res) => {
    const result = await gamificationService.checkInHabit(req.auth.userId, req.params.habitId, getDateKey());
    return res.json(result);
}));
