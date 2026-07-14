import { Router } from "express";
import { AdminController } from "../controllers/adminController";
import {
  authenticateRequest,
  requireAdminAccess,
  requireModeratorAccess,
} from "../http/authentication";
import { uploadMiddleware, challengeUploadMiddleware } from "../http/uploadMiddleware";

const adminRoutes = Router();

// Apply global admin/moderator check for all sub-routes
adminRoutes.use(authenticateRequest);
adminRoutes.use(requireModeratorAccess);

// Uploads
adminRoutes.post("/upload", challengeUploadMiddleware.single('image'), AdminController.uploadImage);
adminRoutes.post("/upload/delete", AdminController.deleteImage);

// Lessons Management
adminRoutes.get("/lessons", AdminController.getLessons);
adminRoutes.post("/lessons", uploadMiddleware.fields([{ name: 'video', maxCount: 1 }, { name: 'thumbnail', maxCount: 1 }]), AdminController.createLesson);
adminRoutes.put("/lessons/:id", uploadMiddleware.fields([{ name: 'video', maxCount: 1 }, { name: 'thumbnail', maxCount: 1 }]), AdminController.updateLesson);
adminRoutes.delete("/lessons/:id", AdminController.deleteLesson);
adminRoutes.patch("/lessons/:id/publish", AdminController.patchPublish);
adminRoutes.patch("/lessons/:id/feature", AdminController.patchFeature);
adminRoutes.post("/transcribe", uploadMiddleware.single('video'), AdminController.transcribeVideo);

// User Management
adminRoutes.get("/users", requireAdminAccess, AdminController.getUsers);
adminRoutes.post(
  "/users/:userId/reset-knowledge",
  requireAdminAccess,
  AdminController.resetKnowledge,
);
adminRoutes.post("/users/:userId/block", requireAdminAccess, AdminController.blockUser);
adminRoutes.post("/users/:userId/unblock", requireAdminAccess, AdminController.unblockUser);

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
adminRoutes.delete("/submissions/:id", AdminController.deleteSubmission);

// Audit Logs
adminRoutes.get("/audit", AdminController.getAuditLogs);
adminRoutes.delete("/audit", requireAdminAccess, AdminController.clearAuditLogs);

// Events Management
adminRoutes.get("/events", AdminController.getEvents);
adminRoutes.post("/events", AdminController.createEvent);
adminRoutes.put("/events/:id", AdminController.updateEvent);
adminRoutes.delete("/events/:id", AdminController.deleteEvent);

export { adminRoutes };
