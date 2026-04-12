import { Response } from "express";
import { AuthenticatedRequest } from "../http/authentication";
import { AdminService } from "../services/adminService";

export class AdminController {
  static async getLessons(req: AuthenticatedRequest, res: Response) {
    try {
      const lessons = await AdminService.getAllLessons();
      return res.status(200).json(lessons);
    } catch (error: any) {
      return res.status(500).json({ message: "Failed to retrieve lessons.", error: error.message });
    }
  }

  static async createLesson(req: AuthenticatedRequest, res: Response) {
    const { title, description, content, isPublished, category } = req.body;

    if (!title || !description || !content) {
      return res.status(400).json({ message: "Missing required lesson fields." });
    }

    try {
      const lesson = await AdminService.createLesson({
        title,
        description,
        content,
        isPublished: !!isPublished,
        createdById: req.auth!.userId,
        category: category || "General"
      });
      return res.status(201).json(lesson);
    } catch (error: any) {
      return res.status(500).json({ message: "Failed to create lesson.", error: error.message });
    }
  }

  static async updateLesson(req: AuthenticatedRequest, res: Response) {
    const { id } = req.params;
    const updateData = req.body;

    try {
      const lesson = await AdminService.updateLesson(id, updateData);
      return res.status(200).json(lesson);
    } catch (error: any) {
      return res.status(500).json({ message: "Failed to update lesson.", error: error.message });
    }
  }

  static async deleteLesson(req: AuthenticatedRequest, res: Response) {
    const { id } = req.params;

    try {
      await AdminService.deleteLesson(id);
      return res.status(204).send();
    } catch (error: any) {
      return res.status(500).json({ message: "Failed to delete lesson.", error: error.message });
    }
  }

  static async patchPublish(req: AuthenticatedRequest, res: Response) {
    const { id } = req.params;
    const { is_published } = req.body;

    if (typeof is_published !== 'boolean') {
      return res.status(400).json({ message: "is_published must be a boolean." });
    }

    try {
      const lesson = await AdminService.togglePublish(id, is_published);
      return res.status(200).json(lesson);
    } catch (error: any) {
      return res.status(500).json({ message: "Failed to toggle publish status.", error: error.message });
    }
  }

  static async resetKnowledge(req: AuthenticatedRequest, res: Response) {
    const { userId } = req.params;

    try {
      await AdminService.resetUserKnowledge(userId);
      return res.status(200).json({ message: "User knowledge points reset to 0." });
    } catch (error: any) {
      return res.status(500).json({ message: "Failed to reset user knowledge points.", error: error.message });
    }
  }

  static async getUsers(req: AuthenticatedRequest, res: Response) {
    try {
      const users = await AdminService.getUsers();
      return res.status(200).json(users);
    } catch (error: any) {
      return res.status(500).json({ message: "Failed to retrieve users.", error: error.message });
    }
  }

  // Challenges
  static async getChallenges(req: AuthenticatedRequest, res: Response) {
    try {
      const items = await AdminService.getAllChallenges();
      return res.status(200).json(items);
    } catch (error: any) {
      return res.status(500).json({ message: "Failed to fetch challenges.", error: error.message });
    }
  }

  static async createChallenge(req: AuthenticatedRequest, res: Response) {
    try {
      const item = await AdminService.createChallenge(req.body);
      return res.status(201).json(item);
    } catch (error: any) {
      return res.status(500).json({ message: "Failed to create challenge.", error: error.message });
    }
  }

  static async updateChallenge(req: AuthenticatedRequest, res: Response) {
    try {
      const item = await AdminService.updateChallenge(req.params.id, req.body);
      return res.status(200).json(item);
    } catch (error: any) {
      return res.status(500).json({ message: "Failed to update challenge.", error: error.message });
    }
  }

  static async deleteChallenge(req: AuthenticatedRequest, res: Response) {
    try {
      await AdminService.deleteChallenge(req.params.id);
      return res.status(204).send();
    } catch (error: any) {
      return res.status(500).json({ message: "Failed to delete challenge.", error: error.message });
    }
  }
}
