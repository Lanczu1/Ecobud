import { Response } from "express";
import { AuthenticatedRequest } from "../http/authentication";
import { AdminService } from "../services/adminService";
import { TranscriptionService } from "../services/transcriptionService";
import { prisma } from "../prismaClient";
import fs from "fs";
import path from "path";

const safelyDeleteUpload = (url?: string | null) => {
  if (!url) return;
  const filename = url.split('/').pop();
  if (!filename) return;
  const filePath = path.join('c:', 'xampp', 'htdocs', 'Ecobud', 'apps', 'api', 'uploads', filename);
  if (fs.existsSync(filePath)) {
    try {
      fs.unlinkSync(filePath);
    } catch (e) {
      console.error('Failed to delete file', filePath, e);
    }
  }
};

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
    const { title, description, isPublished, category, difficulty, quizPassingScore, quizQuestions, durationMinutes, pages, pointsReward } = req.body;

    if (!title || !description) {
      return res.status(400).json({ message: "Missing required lesson fields." });
    }

    let videoUrl = null;
    let imageUrl = null;
    let transcript = req.body.transcript || null;

    const files = req.files as { [fieldname: string]: Express.Multer.File[] };
    if (files && files['video'] && files['video'][0]) {
      videoUrl = `/uploads/${files['video'][0].filename}`;
      // Trigger transcription only if not already provided
      if (!transcript) {
        try {
          transcript = await TranscriptionService.transcribeVideo(files['video'][0].path);
        } catch (err) {
          console.error('Transcription failed, saving without transcript', err);
        }
      }
    } else if (req.body.uploadedVideoUrl) {
      videoUrl = req.body.uploadedVideoUrl;
    }
    
    if (files && files['thumbnail'] && files['thumbnail'][0]) {
      imageUrl = `/uploads/${files['thumbnail'][0].filename}`;
    }

    let parsedQuestions = [];
    if (quizQuestions) {
      try {
        parsedQuestions = typeof quizQuestions === 'string' ? JSON.parse(quizQuestions) : quizQuestions;
      } catch (e) {
        console.error('Failed to parse quiz questions');
      }
    }
    
    let parsedPages = [];
    if (pages) {
      try {
        parsedPages = typeof pages === 'string' ? JSON.parse(pages) : pages;
      } catch (e) {
        console.error('Failed to parse pages');
      }
    }

    try {
      const lesson = await AdminService.createLesson({
        title,
        description,
        content: req.body.content || ' ',
        isPublished: String(isPublished) === 'true',
        createdById: req.auth!.userId,
        category: category || "General",
        difficulty: difficulty || "Beginner",
        videoUrl,
        imageUrl,
        transcript,
        durationMinutes: durationMinutes ? parseInt(durationMinutes, 10) : undefined,
        quizPassingScore: quizPassingScore ? parseInt(quizPassingScore, 10) : 70,
        pointsReward: pointsReward ? parseInt(pointsReward, 10) : 10,
        quizQuestions: parsedQuestions,
        pages: parsedPages
      });
      return res.status(201).json(lesson);
    } catch (error: any) {
      return res.status(500).json({ message: "Failed to create lesson.", error: error.message });
    }
  }

  static async updateLesson(req: AuthenticatedRequest, res: Response) {
    const { id } = req.params;
    const updateData = { ...req.body };
    
    let existingLesson;
    try {
      existingLesson = await prisma.lesson.findUnique({ where: { id } });
    } catch (e) {}

    if (updateData.removeThumbnail === 'true') {
      updateData.imageUrl = null;
      if (existingLesson?.imageUrl) safelyDeleteUpload(existingLesson.imageUrl);
    }
    delete updateData.removeThumbnail;

    if (updateData.removeVideo === 'true') {
      updateData.videoUrl = null;
      updateData.transcript = null;
      if (existingLesson?.videoUrl) safelyDeleteUpload(existingLesson.videoUrl);
    }
    delete updateData.removeVideo;

    const files = req.files as { [fieldname: string]: Express.Multer.File[] };
    if (files && files['video'] && files['video'][0]) {
      updateData.videoUrl = `/uploads/${files['video'][0].filename}`;
      if (existingLesson?.videoUrl && existingLesson.videoUrl !== updateData.videoUrl) {
        safelyDeleteUpload(existingLesson.videoUrl);
      }
      if (!updateData.transcript) {
        try {
          updateData.transcript = await TranscriptionService.transcribeVideo(files['video'][0].path);
        } catch (err) {}
      }
    } else if (updateData.uploadedVideoUrl) {
      updateData.videoUrl = updateData.uploadedVideoUrl;
      if (existingLesson?.videoUrl && existingLesson.videoUrl !== updateData.videoUrl) {
        safelyDeleteUpload(existingLesson.videoUrl);
      }
    }
    delete updateData.uploadedVideoUrl;
    
    if (files && files['thumbnail'] && files['thumbnail'][0]) {
      updateData.imageUrl = `/uploads/${files['thumbnail'][0].filename}`;
      if (existingLesson?.imageUrl && existingLesson.imageUrl !== updateData.imageUrl) {
        safelyDeleteUpload(existingLesson.imageUrl);
      }
    }

    if (updateData.quizQuestions) {
      try {
        updateData.quizQuestions = typeof updateData.quizQuestions === 'string' ? JSON.parse(updateData.quizQuestions) : updateData.quizQuestions;
      } catch (e) {}
    }
    
    if (updateData.pages) {
      try {
        updateData.pages = typeof updateData.pages === 'string' ? JSON.parse(updateData.pages) : updateData.pages;
      } catch (e) {}
    }
    
    if (updateData.quizPassingScore) {
      updateData.quizPassingScore = parseInt(updateData.quizPassingScore, 10);
    }
    
    if (updateData.pointsReward !== undefined) {
      updateData.pointsReward = parseInt(updateData.pointsReward, 10);
    }
    
    if (updateData.isPublished !== undefined) {
      updateData.isPublished = String(updateData.isPublished) === 'true';
    }

    // Clean up non-model fields
    delete updateData.uploadedVideoUrl;
    delete updateData.removeThumbnail;
    delete updateData.removeVideo;

    try {
      const lesson = await AdminService.updateLesson(id, updateData);
      return res.status(200).json(lesson);
    } catch (error: any) {
      return res.status(500).json({ message: "Failed to update lesson.", error: error.message });
    }
  }

  static async transcribeVideo(req: AuthenticatedRequest, res: Response) {
    const file = req.file;
    if (!file) return res.status(400).json({ message: "No video provided." });
    
    try {
      const transcript = await TranscriptionService.transcribeVideo(file.path);
      return res.status(200).json({ transcript, videoUrl: `/uploads/${file.filename}` });
    } catch (error: any) {
      return res.status(500).json({ message: "Failed to transcribe video.", error: error.message });
    }
  }

  static async deleteLesson(req: AuthenticatedRequest, res: Response) {
    const { id } = req.params;

    try {
      const existingLesson = await prisma.lesson.findUnique({ where: { id } });
      if (existingLesson?.imageUrl) safelyDeleteUpload(existingLesson.imageUrl);
      if (existingLesson?.videoUrl) safelyDeleteUpload(existingLesson.videoUrl);

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

  static async blockUser(req: AuthenticatedRequest, res: Response) {
    const { userId } = req.params;
    try {
      await AdminService.blockUser(userId, req.auth!.userId);
      return res.status(200).json({ message: "User blocked successfully." });
    } catch (error: any) {
      return res.status(500).json({ message: "Failed to block user.", error: error.message });
    }
  }

  static async unblockUser(req: AuthenticatedRequest, res: Response) {
    const { userId } = req.params;
    try {
      await AdminService.unblockUser(userId, req.auth!.userId);
      return res.status(200).json({ message: "User unblocked successfully." });
    } catch (error: any) {
      return res.status(500).json({ message: "Failed to unblock user.", error: error.message });
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

  static async uploadImage(req: AuthenticatedRequest, res: Response) {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded." });
      }
      const protocol = req.protocol || 'http';
      const host = req.get('host') || 'localhost:3000';
      const fileUrl = `${protocol}://${host}/uploads/Challenges/${req.file.filename}`;
      return res.status(201).json({ url: fileUrl });
    } catch (error: any) {
      return res.status(500).json({ message: "Failed to upload image.", error: error.message });
    }
  }

  static async deleteImage(req: AuthenticatedRequest, res: Response) {
    try {
      const { url } = req.body;
      if (!url) return res.status(400).json({ message: 'URL is required' });

      // Parse the filename from the URL (e.g. http://localhost:3000/uploads/Challenges/filename.jpg)
      const urlParts = url.split('/');
      const filename = urlParts[urlParts.length - 1];
      
      if (!filename) return res.status(400).json({ message: 'Invalid URL' });

      const fs = require('fs');
      const path = require('path');
      const filePath = path.join('c:', 'xampp', 'htdocs', 'Ecobud', 'apps', 'api', 'uploads', 'Challenges', filename);

      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        return res.json({ message: 'Image deleted successfully' });
      } else {
        return res.status(404).json({ message: 'Image not found on server' });
      }
    } catch (error: any) {
      return res.status(500).json({ message: 'Failed to delete image', error: error.message });
    }
  }

  static async getDashboardStats(req: AuthenticatedRequest, res: Response) {
    try {
      const stats = await AdminService.getDashboardStats();
      return res.status(200).json(stats);
    } catch (error: any) {
      return res.status(500).json({ message: "Failed to fetch dashboard stats.", error: error.message });
    }
  }

  static async getSubmissions(req: AuthenticatedRequest, res: Response) {
    try {
      const items = await AdminService.getSubmissions();
      return res.status(200).json(items);
    } catch (error: any) {
      return res.status(500).json({ message: "Failed to fetch submissions.", error: error.message });
    }
  }

  static async reviewSubmission(req: AuthenticatedRequest, res: Response) {
    const { id } = req.params;
    const { status, notes } = req.body;

    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ message: "Status must be approved or rejected." });
    }

    try {
      const item = await AdminService.reviewSubmission(id, req.auth!.userId, status, notes);
      return res.status(200).json(item);
    } catch (error: any) {
      return res.status(500).json({ message: "Failed to review submission.", error: error.message });
    }
  }

  static async deleteSubmission(req: AuthenticatedRequest, res: Response) {
    const { id } = req.params;

    try {
      const submission = await prisma.challengeSubmission.findUnique({ where: { id } });
      if (submission?.proofUrl) {
        const filename = submission.proofUrl.split('/').pop();
        if (filename) {
          const fs = require('fs');
          const path = require('path');
          const filePath = path.join('c:', 'xampp', 'htdocs', 'Ecobud', 'apps', 'api', 'uploads', 'Challenges', 'AnalyzingImg', filename);
          if (fs.existsSync(filePath)) {
            try {
              fs.unlinkSync(filePath);
            } catch (e) {
              console.error('Failed to delete submission image', filePath, e);
            }
          }
        }
      }

      await AdminService.deleteSubmission(id);
      return res.status(204).send();
    } catch (error: any) {
      return res.status(500).json({ message: "Failed to delete submission.", error: error.message });
    }
  }

  static async getAuditLogs(req: AuthenticatedRequest, res: Response) {
    try {
      const items = await AdminService.getAuditLogs();
      return res.status(200).json(items);
    } catch (error: any) {
      return res.status(500).json({ message: "Failed to fetch audit logs.", error: error.message });
    }
  }

  static async clearAuditLogs(req: AuthenticatedRequest, res: Response) {
    try {
      await AdminService.clearAuditLogs();
      return res.status(200).json({ message: "Audit logs cleared successfully." });
    } catch (error: any) {
      return res.status(500).json({ message: "Failed to clear audit logs.", error: error.message });
    }
  }

  // Events
  static async getEvents(req: AuthenticatedRequest, res: Response) {
    try {
      const items = await AdminService.getAllEvents();
      return res.status(200).json(items);
    } catch (error: any) {
      return res.status(500).json({ message: "Failed to fetch events.", error: error.message });
    }
  }

  static async createEvent(req: AuthenticatedRequest, res: Response) {
    try {
      const item = await AdminService.createEvent({ ...req.body, managedById: req.auth!.userId });
      return res.status(201).json(item);
    } catch (error: any) {
      return res.status(500).json({ message: "Failed to create event.", error: error.message });
    }
  }

  static async updateEvent(req: AuthenticatedRequest, res: Response) {
    try {
      const item = await AdminService.updateEvent(req.params.id, req.body);
      return res.status(200).json(item);
    } catch (error: any) {
      return res.status(500).json({ message: "Failed to update event.", error: error.message });
    }
  }

  static async deleteEvent(req: AuthenticatedRequest, res: Response) {
    try {
      await AdminService.deleteEvent(req.params.id);
      return res.status(204).send();
    } catch (error: any) {
      return res.status(500).json({ message: "Failed to delete event.", error: error.message });
    }
  }
}
