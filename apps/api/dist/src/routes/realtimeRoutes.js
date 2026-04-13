"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.realtimeRoutes = void 0;
const express_1 = require("express");
const authentication_1 = require("../http/authentication");
const errorResponder_1 = require("../http/errorResponder");
const supabaseRealtimeService_1 = require("../services/supabaseRealtimeService");
const userActivityService_1 = require("../services/userActivityService");
const realtimeRoutes = (0, express_1.Router)();
exports.realtimeRoutes = realtimeRoutes;
const userActivityService = new userActivityService_1.UserActivityService();
realtimeRoutes.get('/session', authentication_1.authenticateRequest, authentication_1.requireUserAccess, (0, errorResponder_1.errorBoundary)(async (req, res) => {
    const auth = req.auth;
    await userActivityService.touchUserActivity(auth.userId);
    await supabaseRealtimeService_1.supabaseRealtimeService.publishAdminSectionBundle(['dashboard', 'users'], {
        actorRole: auth.role,
        actorUserId: auth.userId,
        entityId: auth.userId,
        reason: 'session-heartbeat',
    });
    return res.json(supabaseRealtimeService_1.supabaseRealtimeService.getSession(auth.userId, auth.role));
}));
