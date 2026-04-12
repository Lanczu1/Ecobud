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
}
exports.AdminController = AdminController;
