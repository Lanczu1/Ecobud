"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminController = void 0;
const adminService_1 = require("../services/adminService");
class AdminController {
    static async getLessons(req, res) {
        try {
            const lessons = await adminService_1.AdminService.getAllLessons();
            return res.status(200).json(lessons);
        }
        catch (error) {
            return res.status(500).json({ message: "Failed to retrieve lessons.", error: error.message });
        }
    }
    static async createLesson(req, res) {
        const { title, description, content, isPublished, category } = req.body;
        if (!title || !description || !content) {
            return res.status(400).json({ message: "Missing required lesson fields." });
        }
        try {
            const lesson = await adminService_1.AdminService.createLesson({
                title,
                description,
                content,
                isPublished: !!isPublished,
                createdById: req.auth.userId,
                category: category || "General"
            });
            return res.status(201).json(lesson);
        }
        catch (error) {
            return res.status(500).json({ message: "Failed to create lesson.", error: error.message });
        }
    }
    static async updateLesson(req, res) {
        const { id } = req.params;
        const updateData = req.body;
        try {
            const lesson = await adminService_1.AdminService.updateLesson(id, updateData);
            return res.status(200).json(lesson);
        }
        catch (error) {
            return res.status(500).json({ message: "Failed to update lesson.", error: error.message });
        }
    }
    static async deleteLesson(req, res) {
        const { id } = req.params;
        try {
            await adminService_1.AdminService.deleteLesson(id);
            return res.status(204).send();
        }
        catch (error) {
            return res.status(500).json({ message: "Failed to delete lesson.", error: error.message });
        }
    }
    static async patchPublish(req, res) {
        const { id } = req.params;
        const { is_published } = req.body;
        if (typeof is_published !== 'boolean') {
            return res.status(400).json({ message: "is_published must be a boolean." });
        }
        try {
            const lesson = await adminService_1.AdminService.togglePublish(id, is_published);
            return res.status(200).json(lesson);
        }
        catch (error) {
            return res.status(500).json({ message: "Failed to toggle publish status.", error: error.message });
        }
    }
    static async resetKnowledge(req, res) {
        const { userId } = req.params;
        try {
            await adminService_1.AdminService.resetUserKnowledge(userId);
            return res.status(200).json({ message: "User knowledge points reset to 0." });
        }
        catch (error) {
            return res.status(500).json({ message: "Failed to reset user knowledge points.", error: error.message });
        }
    }
    static async getUsers(req, res) {
        try {
            const users = await adminService_1.AdminService.getUsers();
            return res.status(200).json(users);
        }
        catch (error) {
            return res.status(500).json({ message: "Failed to retrieve users.", error: error.message });
        }
    }
    // Challenges
    static async getChallenges(req, res) {
        try {
            const items = await adminService_1.AdminService.getAllChallenges();
            return res.status(200).json(items);
        }
        catch (error) {
            return res.status(500).json({ message: "Failed to fetch challenges.", error: error.message });
        }
    }
    static async createChallenge(req, res) {
        try {
            const item = await adminService_1.AdminService.createChallenge(req.body);
            return res.status(201).json(item);
        }
        catch (error) {
            return res.status(500).json({ message: "Failed to create challenge.", error: error.message });
        }
    }
    static async updateChallenge(req, res) {
        try {
            const item = await adminService_1.AdminService.updateChallenge(req.params.id, req.body);
            return res.status(200).json(item);
        }
        catch (error) {
            return res.status(500).json({ message: "Failed to update challenge.", error: error.message });
        }
    }
    static async deleteChallenge(req, res) {
        try {
            await adminService_1.AdminService.deleteChallenge(req.params.id);
            return res.status(204).send();
        }
        catch (error) {
            return res.status(500).json({ message: "Failed to delete challenge.", error: error.message });
        }
    }
    static async getDashboardStats(req, res) {
        try {
            const stats = await adminService_1.AdminService.getDashboardStats();
            return res.status(200).json(stats);
        }
        catch (error) {
            return res.status(500).json({ message: "Failed to fetch dashboard stats.", error: error.message });
        }
    }
    static async getSubmissions(req, res) {
        try {
            const items = await adminService_1.AdminService.getSubmissions();
            return res.status(200).json(items);
        }
        catch (error) {
            return res.status(500).json({ message: "Failed to fetch submissions.", error: error.message });
        }
    }
    static async reviewSubmission(req, res) {
        const { id } = req.params;
        const { status, notes } = req.body;
        if (!['approved', 'rejected'].includes(status)) {
            return res.status(400).json({ message: "Status must be approved or rejected." });
        }
        try {
            const item = await adminService_1.AdminService.reviewSubmission(id, req.auth.userId, status, notes);
            return res.status(200).json(item);
        }
        catch (error) {
            return res.status(500).json({ message: "Failed to review submission.", error: error.message });
        }
    }
    static async getAuditLogs(req, res) {
        try {
            const items = await adminService_1.AdminService.getAuditLogs();
            return res.status(200).json(items);
        }
        catch (error) {
            return res.status(500).json({ message: "Failed to fetch audit logs.", error: error.message });
        }
    }
}
exports.AdminController = AdminController;
