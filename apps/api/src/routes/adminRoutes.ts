import { Router } from "express";
import { AdminController } from "../controllers/adminController";
import {
  authenticateRequest,
  requireAdminAccess,
  requireModeratorAccess,
} from "../http/authentication";

const adminRoutes = Router();

// Apply global admin/moderator check for all sub-routes
adminRoutes.use(authenticateRequest);
adminRoutes.use(requireModeratorAccess);

// Lessons Management
adminRoutes.get("/lessons", AdminController.getLessons);
adminRoutes.post("/lessons", AdminController.createLesson);
adminRoutes.put("/lessons/:id", AdminController.updateLesson);
adminRoutes.delete("/lessons/:id", AdminController.deleteLesson);
adminRoutes.patch("/lessons/:id/publish", AdminController.patchPublish);

// User Management
adminRoutes.get("/users", requireAdminAccess, AdminController.getUsers);
adminRoutes.post(
  "/users/:userId/reset-knowledge",
  requireAdminAccess,
  AdminController.resetKnowledge,
);

// Challenges Management
adminRoutes.get("/challenges", AdminController.getChallenges);
adminRoutes.post("/challenges", AdminController.createChallenge);
adminRoutes.put("/challenges/:id", AdminController.updateChallenge);
adminRoutes.delete("/challenges/:id", AdminController.deleteChallenge);

// Dashboard Stats
adminRoutes.get("/stats", requireAdminAccess, AdminController.getDashboardStats);

// Submissions
adminRoutes.get("/submissions", AdminController.getSubmissions);
adminRoutes.post("/submissions/:id/review", AdminController.reviewSubmission);

// Audit Logs
adminRoutes.get("/audit", AdminController.getAuditLogs);

export { adminRoutes };
