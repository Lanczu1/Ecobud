"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.eventRoutes = void 0;
const express_1 = require("express");
const prismaClient_1 = require("../prismaClient");
const authentication_1 = require("../http/authentication");
const errorResponder_1 = require("../http/errorResponder");
const eventRoutes = (0, express_1.Router)();
exports.eventRoutes = eventRoutes;
eventRoutes.get('/', (0, errorResponder_1.errorBoundary)(async (_req, res) => {
    const events = await prismaClient_1.prisma.event.findMany({
        include: {
            registrations: true,
        },
        orderBy: { date: 'asc' },
    });
    return res.json({
        items: events.map((event) => ({
            ...event,
            spotsLeft: Math.max(0, event.capacity - event.registrations.length),
        })),
    });
}));
eventRoutes.post('/:eventId/join', authentication_1.authenticateRequest, (0, errorResponder_1.errorBoundary)(async (req, res) => {
    const event = await prismaClient_1.prisma.event.findUnique({
        where: { id: req.params.eventId },
        include: { registrations: true },
    });
    if (!event) {
        throw new errorResponder_1.HttpError(404, 'Event not found.');
    }
    const existingRegistration = event.registrations.find((registration) => registration.userId === req.auth.userId);
    if (existingRegistration) {
        return res.json({ alreadyJoined: true, registration: existingRegistration });
    }
    if (event.registrations.length >= event.capacity) {
        throw new errorResponder_1.HttpError(409, 'This event is already full.');
    }
    const registration = await prismaClient_1.prisma.eventRegistration.create({
        data: {
            userId: req.auth.userId,
            eventId: event.id,
        },
    });
    return res.status(201).json({ alreadyJoined: false, registration });
}));
