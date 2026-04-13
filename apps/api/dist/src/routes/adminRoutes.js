"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminRoutes = void 0;
const express_1 = require("express");
const adminController_1 = require("../controllers/adminController");
const authentication_1 = require("../http/authentication");
const adminRoutes = (0, express_1.Router)();
exports.adminRoutes = adminRoutes;
// Apply global admin/moderator check for all sub-routes
adminRoutes.use(authentication_1.authenticateRequest);
adminRoutes.use(authentication_1.requireModeratorAccess);
// Lessons Management
adminRoutes.get("/lessons", adminController_1.AdminController.getLessons);
adminRoutes.post("/lessons", adminController_1.AdminController.createLesson);
adminRoutes.put("/lessons/:id", adminController_1.AdminController.updateLesson);
adminRoutes.delete("/lessons/:id", adminController_1.AdminController.deleteLesson);
adminRoutes.patch("/lessons/:id/publish", adminController_1.AdminController.patchPublish);
// User Management
adminRoutes.get("/users", adminController_1.AdminController.getUsers);
adminRoutes.post("/users/:userId/reset-knowledge", adminController_1.AdminController.resetKnowledge);
// Challenges Management
adminRoutes.get("/challenges", adminController_1.AdminController.getChallenges);
adminRoutes.post("/challenges", adminController_1.AdminController.createChallenge);
adminRoutes.put("/challenges/:id", adminController_1.AdminController.updateChallenge);
adminRoutes.delete("/challenges/:id", adminController_1.AdminController.deleteChallenge);
// Dashboard Stats
adminRoutes.get("/stats", adminController_1.AdminController.getDashboardStats);
// Submissions
adminRoutes.get("/submissions", adminController_1.AdminController.getSubmissions);
adminRoutes.post("/submissions/:id/review", adminController_1.AdminController.reviewSubmission);
// Audit Logs
adminRoutes.get("/audit", adminController_1.AdminController.getAuditLogs);
