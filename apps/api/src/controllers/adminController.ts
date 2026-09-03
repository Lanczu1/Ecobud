import { Response } from "express";
import { AuthenticatedRequest } from "../http/authentication";
import { AdminService } from "../services/adminService";
import { TranscriptionService } from "../services/transcriptionService";
import { supabaseStorageService } from "../services/supabaseStorageService";
import { prisma } from "../prismaClient";
import fs from "fs";
import path from "path";

const safelyDeleteUpload = async (url?: string | null) => {
  if (!url) return;
  // If it's a Supabase storage URL
  if (url.startsWith('http://') || url.startsWith('https://')) {
    await supabaseStorageService.deleteFile(url);
    return;
  }
  const relativePath = url.replace(/^\/uploads\//, '');
  const filePath = path.join(__dirname, '..', '..', 'uploads', ...relativePath.split('/'));
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
    const { title, description, isPublished, category, difficulty, quizPassingScore, quizQuestions, durationMinutes, pages, pointsReward, scheduledAt } = req.body;

    if (!title || !description) {
      return res.status(400).json({ message: "Missing required lesson fields." });
    }

    let videoUrl = null;
    let imageUrl = null;
    let transcript = req.body.transcript || null;

    const files = req.files as { [fieldname: string]: Express.Multer.File[] };
    if (files && files['video'] && files['video'][0]) {
      const videoFile = files['video'][0];
      // Trigger transcription only if not already provided (using local temp file)
      if (!transcript) {
        try {
          transcript = await TranscriptionService.transcribeVideo(videoFile.path);
        } catch (err) {
          console.error('Transcription failed, saving without transcript', err);
        }
      }

      try {
        const ext = path.extname(videoFile.originalname) || '.mp4';
        videoUrl = await supabaseStorageService.uploadFile(
          `lessons/videos/lesson-${Date.now()}${ext}`,
          videoFile.path,
          videoFile.mimetype
        );
      } catch (err) {
        console.error('Failed to upload lesson video to Supabase:', err);
      } finally {
        if (fs.existsSync(videoFile.path)) {
          try { fs.unlinkSync(videoFile.path); } catch {}
        }
      }
    } else if (req.body.uploadedVideoUrl) {
      videoUrl = req.body.uploadedVideoUrl;
    }
    
    if (files && files['thumbnail'] && files['thumbnail'][0]) {
      const thumbFile = files['thumbnail'][0];
      try {
        const ext = path.extname(thumbFile.originalname) || '.jpg';
        imageUrl = await supabaseStorageService.uploadFile(
          `lessons/thumbnails/lesson-thumb-${Date.now()}${ext}`,
          thumbFile.path,
          thumbFile.mimetype
        );
      } catch (err) {
        console.error('Failed to upload lesson thumbnail to Supabase:', err);
      } finally {
        if (fs.existsSync(thumbFile.path)) {
          try { fs.unlinkSync(thumbFile.path); } catch {}
        }
      }
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
        durationMinutes: durationMinutes !== undefined && durationMinutes !== '' ? parseInt(durationMinutes, 10) : 0,
        quizPassingScore: quizPassingScore ? parseInt(quizPassingScore, 10) : 70,
        pointsReward: pointsReward ? parseInt(pointsReward, 10) : 10,
        featured: String(req.body.featured) === 'true',
        quizQuestions: parsedQuestions,
        pages: parsedPages,
        scheduledAt: scheduledAt ? new Date(scheduledAt) : undefined
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
      const videoFile = files['video'][0];
      if (!updateData.transcript) {
        try {
          updateData.transcript = await TranscriptionService.transcribeVideo(videoFile.path);
        } catch (err) {}
      }

      try {
        const ext = path.extname(videoFile.originalname) || '.mp4';
        const newVideoUrl = await supabaseStorageService.uploadFile(
          `lessons/videos/lesson-${Date.now()}${ext}`,
          videoFile.path,
          videoFile.mimetype
        );
        updateData.videoUrl = newVideoUrl;
        if (existingLesson?.videoUrl && existingLesson.videoUrl !== newVideoUrl) {
          safelyDeleteUpload(existingLesson.videoUrl);
        }
      } catch (err) {
        console.error('Failed to upload updated video to Supabase:', err);
      } finally {
        if (fs.existsSync(videoFile.path)) {
          try { fs.unlinkSync(videoFile.path); } catch {}
        }
      }
    } else if (updateData.uploadedVideoUrl) {
      updateData.videoUrl = updateData.uploadedVideoUrl;
      if (existingLesson?.videoUrl && existingLesson.videoUrl !== updateData.videoUrl) {
        safelyDeleteUpload(existingLesson.videoUrl);
      }
    }
    delete updateData.uploadedVideoUrl;
    
    if (files && files['thumbnail'] && files['thumbnail'][0]) {
      const thumbFile = files['thumbnail'][0];
      try {
        const ext = path.extname(thumbFile.originalname) || '.jpg';
        const newImageUrl = await supabaseStorageService.uploadFile(
          `lessons/thumbnails/lesson-thumb-${Date.now()}${ext}`,
          thumbFile.path,
          thumbFile.mimetype
        );
        updateData.imageUrl = newImageUrl;
        if (existingLesson?.imageUrl && existingLesson.imageUrl !== newImageUrl) {
          safelyDeleteUpload(existingLesson.imageUrl);
        }
      } catch (err) {
        console.error('Failed to upload updated thumbnail to Supabase:', err);
      } finally {
        if (fs.existsSync(thumbFile.path)) {
          try { fs.unlinkSync(thumbFile.path); } catch {}
        }
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

    if (updateData.durationMinutes !== undefined && updateData.durationMinutes !== '') {
      updateData.durationMinutes = parseInt(updateData.durationMinutes, 10);
    } else if (updateData.durationMinutes === '') {
      updateData.durationMinutes = 0;
    }

    if (updateData.scheduledAt) {
      updateData.scheduledAt = new Date(updateData.scheduledAt);
    } else if (updateData.scheduledAt === '') {
      updateData.scheduledAt = null;
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
      const ext = path.extname(file.originalname) || '.mp4';
      const videoUrl = await supabaseStorageService.uploadFile(
        `lessons/videos/transcribed-${Date.now()}${ext}`,
        file.path,
        file.mimetype
      );
      return res.status(200).json({ transcript, videoUrl });
    } catch (error: any) {
      return res.status(500).json({ message: "Failed to transcribe video.", error: error.message });
    } finally {
      if (file && fs.existsSync(file.path)) {
        try { fs.unlinkSync(file.path); } catch {}
      }
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

  static async patchFeature(req: AuthenticatedRequest, res: Response) {
    const { id } = req.params;
    const { featured } = req.body;

    if (typeof featured !== 'boolean') {
      return res.status(400).json({ message: "featured must be a boolean." });
    }

    try {
      const lesson = await AdminService.toggleFeature(id, featured);
      return res.status(200).json(lesson);
    } catch (error: any) {
      return res.status(500).json({ message: "Failed to toggle featured status.", error: error.message });
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
      const ext = path.extname(req.file.originalname) || '.jpg';
      const destinationPath = `challenges/general/challenge-${Date.now()}${ext}`;
      const fileUrl = await supabaseStorageService.uploadFile(
        destinationPath,
        req.file.path,
        req.file.mimetype
      );

      // Clean up local temp file
      try {
        if (fs.existsSync(req.file.path)) {
          fs.unlinkSync(req.file.path);
        }
      } catch (e) {
        console.error('Failed to remove temp uploaded challenge file:', e);
      }

      return res.status(201).json({ url: fileUrl });
    } catch (error: any) {
      if (req.file && fs.existsSync(req.file.path)) {
        try { fs.unlinkSync(req.file.path); } catch {}
      }
      return res.status(500).json({ message: "Failed to upload image.", error: error.message });
    }
  }

  static async deleteImage(req: AuthenticatedRequest, res: Response) {
    try {
      const { url } = req.body;
      if (!url) return res.status(400).json({ message: 'URL is required' });

      await safelyDeleteUpload(url);
      return res.json({ message: 'Image deleted successfully' });
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
      const isModerator = req.auth?.role === 'moderator';
      // For moderators: strictly enforce their assigned barangay, completely ignore query param
      // For admins: optionally allow filtering by query param if provided
      const filterBarangay = isModerator
        ? (req.auth?.city || null)
        : ((req.query.barangay as string) || null);

      const items = await AdminService.getSubmissions(filterBarangay);
      return res.status(200).json(items);
    } catch (error: any) {
      return res.status(500).json({ message: "Failed to fetch submissions.", error: error.message });
    }
  }

  static async reviewSubmission(req: AuthenticatedRequest, res: Response) {
    const { id } = req.params;
    const { status, notes } = req.body;

    if (!['approved', 'rejected', 'approved_collection'].includes(status)) {
      return res.status(400).json({ message: "Status must be approved, approved_collection, or rejected." });
    }

    try {
      const reviewerContext = {
        role: req.auth!.role,
        city: req.auth!.city,
      };
      const item = await AdminService.reviewSubmission(id, req.auth!.userId, status, notes, reviewerContext);
      return res.status(200).json(item);
    } catch (error: any) {
      if (error.message === 'UNAUTHORIZED_BARANGAY_ACCESS') {
        return res.status(403).json({ message: "Forbidden: You cannot review submissions outside your assigned barangay." });
      }
      if (error.message === 'Submission not found') {
        return res.status(404).json({ message: "Submission not found." });
      }
      return res.status(500).json({ message: "Failed to review submission.", error: error.message });
    }
  }

  static async deleteSubmission(req: AuthenticatedRequest, res: Response) {
    const { id } = req.params;

    try {
      const reviewerContext = {
        role: req.auth!.role,
        city: req.auth!.city,
      };

      const submission = await prisma.challengeSubmission.findUnique({
        where: { id },
        include: { user: { include: { profile: true } } },
      });
      if (submission) {
        if (reviewerContext.role === 'moderator') {
          const assigned = reviewerContext.city?.trim().toLowerCase();
          const subBarangay = submission.user.profile?.city?.trim().toLowerCase();
          if (!assigned || assigned !== subBarangay) {
            return res.status(403).json({ message: "Forbidden: You cannot delete submissions outside your assigned barangay." });
          }
        }
        if (submission.proofUrl) {
          await safelyDeleteUpload(submission.proofUrl);
        }
        if (submission.afterProofUrl) {
          await safelyDeleteUpload(submission.afterProofUrl);
        }
        await AdminService.deleteSubmission(id, reviewerContext);
      } else {
        const eventSubmission = await prisma.eventSubmission.findUnique({
          where: { id },
          include: { user: { include: { profile: true } } },
        });
        if (eventSubmission) {
          if (reviewerContext.role === 'moderator') {
            const assigned = reviewerContext.city?.trim().toLowerCase();
            const subBarangay = eventSubmission.user?.profile?.city?.trim().toLowerCase();
            if (!assigned || assigned !== subBarangay) {
              return res.status(403).json({ message: "Forbidden: You cannot delete submissions outside your assigned barangay." });
            }
          }
          if (eventSubmission.attendanceImageUrl) {
            await safelyDeleteUpload(eventSubmission.attendanceImageUrl);
          }
          await AdminService.deleteEventSubmission(id, reviewerContext);
        } else {
          return res.status(404).json({ message: 'Submission not found' });
        }
      }

      return res.status(204).send();
    } catch (error: any) {
      if (error.message === 'UNAUTHORIZED_BARANGAY_ACCESS') {
        return res.status(403).json({ message: "Forbidden: You cannot delete submissions outside your assigned barangay." });
      }
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
      const payload = { ...req.body };
      if (payload.capacity) payload.capacity = parseInt(payload.capacity, 10);
      if (payload.pointsReward) payload.pointsReward = parseInt(payload.pointsReward, 10);
      if (payload.coinReward !== undefined) payload.coinReward = parseInt(payload.coinReward, 10);
      if (payload.latitude) payload.latitude = parseFloat(payload.latitude);
      if (payload.longitude) payload.longitude = parseFloat(payload.longitude);
      if (payload.isFeatured !== undefined) {
        payload.isFeatured = payload.isFeatured === true || payload.isFeatured === 'true';
      }

      if (req.file) {
        try {
          const ext = path.extname(req.file.originalname) || '.jpg';
          payload.imageUrl = await supabaseStorageService.uploadFile(
            `events/covers/event-${Date.now()}${ext}`,
            req.file.path,
            req.file.mimetype
          );
        } finally {
          if (fs.existsSync(req.file.path)) {
            try { fs.unlinkSync(req.file.path); } catch {}
          }
        }
      }

      const item = await AdminService.createEvent({ ...payload, managedById: req.auth!.userId });
      return res.status(201).json(item);
    } catch (error: any) {
      if (req.file && fs.existsSync(req.file.path)) {
        try { fs.unlinkSync(req.file.path); } catch {}
      }
      return res.status(500).json({ message: "Failed to create event.", error: error.message });
    }
  }

  static async updateEvent(req: AuthenticatedRequest, res: Response) {
    try {
      const payload = { ...req.body };
      if (payload.capacity) payload.capacity = parseInt(payload.capacity, 10);
      if (payload.pointsReward) payload.pointsReward = parseInt(payload.pointsReward, 10);
      if (payload.coinReward !== undefined) payload.coinReward = parseInt(payload.coinReward, 10);
      if (payload.latitude) payload.latitude = parseFloat(payload.latitude);
      if (payload.longitude) payload.longitude = parseFloat(payload.longitude);
      if (payload.isFeatured !== undefined) {
        payload.isFeatured = payload.isFeatured === true || payload.isFeatured === 'true';
      }

      let existingEvent;
      try {
        existingEvent = await prisma.event.findUnique({ where: { id: req.params.id } });
      } catch (e) {}

      if (req.file) {
        try {
          const ext = path.extname(req.file.originalname) || '.jpg';
          payload.imageUrl = await supabaseStorageService.uploadFile(
            `events/covers/event-${Date.now()}${ext}`,
            req.file.path,
            req.file.mimetype
          );
          if (existingEvent?.imageUrl && existingEvent.imageUrl !== payload.imageUrl) {
            await safelyDeleteUpload(existingEvent.imageUrl);
          }
        } finally {
          if (fs.existsSync(req.file.path)) {
            try { fs.unlinkSync(req.file.path); } catch {}
          }
        }
      } else if (payload.imageUrl === '') {
        payload.imageUrl = null;
        if (existingEvent?.imageUrl) await safelyDeleteUpload(existingEvent.imageUrl);
      }

      const item = await AdminService.updateEvent(req.params.id, payload);
      return res.status(200).json(item);
    } catch (error: any) {
      if (req.file && fs.existsSync(req.file.path)) {
        try { fs.unlinkSync(req.file.path); } catch {}
      }
      return res.status(500).json({ message: "Failed to update event.", error: error.message });
    }
  }

  static async deleteEvent(req: AuthenticatedRequest, res: Response) {
    try {
      const existingEvent = await prisma.event.findUnique({ where: { id: req.params.id } });
      if (existingEvent?.imageUrl) await safelyDeleteUpload(existingEvent.imageUrl);

      await AdminService.deleteEvent(req.params.id);
      return res.status(204).send();
    } catch (error: any) {
      return res.status(500).json({ message: "Failed to delete event.", error: error.message });
    }
  }

  static async getEventQr(req: AuthenticatedRequest, res: Response) {
    try {
      const qrCode = await AdminService.getEventQr(req.params.id);
      if (!qrCode) return res.status(404).json({ message: 'No QR code generated yet.' });
      return res.status(200).json(qrCode);
    } catch (error: any) {
      return res.status(500).json({ message: "Failed to get QR code.", error: error.message });
    }
  }

  static async generateEventQr(req: AuthenticatedRequest, res: Response) {
    try {
      const qrCode = await AdminService.generateEventQr(req.params.id);
      return res.status(201).json(qrCode);
    } catch (error: any) {
      return res.status(500).json({ message: "Failed to generate QR code.", error: error.message });
    }
  }
}
