import { Response } from 'express';
import { z } from 'zod';
import { AuthenticatedRequest } from '../http/authentication';
import { LearnService } from '../services/LearnService';

const learnService = new LearnService();

const lessonActionSchema = z.object({
  lessonId: z.string().min(1),
});

export const learnController = {
  async getLessons(req: AuthenticatedRequest, res: Response) {
    const lessons = await learnService.getPublishedLessons(req.auth!.userId);
    return res.json(lessons);
  },

  async markSeen(req: AuthenticatedRequest, res: Response) {
    const { lessonId } = lessonActionSchema.parse(req.body);
    const result = await learnService.markLessonSeen(req.auth!.userId, lessonId);
    return res.json(result);
  },

  async completeLesson(req: AuthenticatedRequest, res: Response) {
    const { lessonId } = lessonActionSchema.parse(req.body);
    const result = await learnService.completeLesson(req.auth!.userId, lessonId);
    return res.json(result);
  },
};
