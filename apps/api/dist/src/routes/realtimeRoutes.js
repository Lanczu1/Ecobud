"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.realtimeRoutes = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const authentication_1 = require("../http/authentication");
const errorResponder_1 = require("../http/errorResponder");
const presenceService_1 = require("../services/presenceService");
const supabaseRealtimeService_1 = require("../services/supabaseRealtimeService");
const realtimeRoutes = (0, express_1.Router)();
exports.realtimeRoutes = realtimeRoutes;
const presenceSchema = zod_1.z.object({
    sessionId: zod_1.z.string().min(1).max(255).optional(),
    appState: zod_1.z.enum(['active', 'background', 'inactive']),
    connectionState: zod_1.z.enum(['online', 'offline', 'reconnecting', 'stale']),
});
realtimeRoutes.get('/session', authentication_1.authenticateRequest, authentication_1.requireUserAccess, (0, errorResponder_1.errorBoundary)(async (req, res) => {
    const auth = req.auth;
    return res.json(supabaseRealtimeService_1.supabaseRealtimeService.getSession(auth.userId, auth.role));
}));
realtimeRoutes.post('/presence/connect', authentication_1.authenticateRequest, authentication_1.requireUserAccess, (0, errorResponder_1.errorBoundary)(async (req, res) => {
    const auth = req.auth;
    const payload = presenceSchema.parse(req.body);
    const presence = await presenceService_1.presenceService.connectSession({
        userId: auth.userId,
        sessionId: payload.sessionId,
        appState: payload.appState,
        connectionState: payload.connectionState,
    }, {
        actorRole: auth.role,
        actorUserId: auth.userId,
        entityId: auth.userId,
        reason: 'presence-connected',
    });
    return res.status(200).json({ presence });
}));
realtimeRoutes.post('/presence/heartbeat', authentication_1.authenticateRequest, authentication_1.requireUserAccess, (0, errorResponder_1.errorBoundary)(async (req, res) => {
    const auth = req.auth;
    const payload = presenceSchema.parse(req.body);
    const presence = await presenceService_1.presenceService.heartbeatSession({
        userId: auth.userId,
        sessionId: payload.sessionId,
        appState: payload.appState,
        connectionState: payload.connectionState,
    }, {
        actorRole: auth.role,
        actorUserId: auth.userId,
        entityId: auth.userId,
        reason: 'presence-heartbeat',
    });
    return res.status(200).json({ presence });
}));
realtimeRoutes.post('/presence/disconnect', authentication_1.authenticateRequest, authentication_1.requireUserAccess, (0, errorResponder_1.errorBoundary)(async (req, res) => {
    const auth = req.auth;
    const payload = presenceSchema.parse(req.body);
    const presence = await presenceService_1.presenceService.disconnectSession({
        userId: auth.userId,
        sessionId: payload.sessionId,
        appState: payload.appState,
        connectionState: payload.connectionState,
    }, {
        actorRole: auth.role,
        actorUserId: auth.userId,
        entityId: auth.userId,
        reason: 'presence-disconnected',
    });
    return res.status(200).json({ presence });
}));
