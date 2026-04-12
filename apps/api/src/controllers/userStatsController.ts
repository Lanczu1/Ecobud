import { Response } from 'express';
import { z } from 'zod';
import { AuthenticatedRequest } from '../http/authentication';
import { UserStatsService } from '../services/UserStatsService';

const userStatsService = new UserStatsService();

const resetKnowledgeSchema = z.object({
  userId: z.string().min(1).optional(),
});

export const userStatsController = {
  async resetKnowledgePoints(req: AuthenticatedRequest, res: Response) {
    const payload = resetKnowledgeSchema.parse(req.body ?? {});
    const result = await userStatsService.resetKnowledgePoints({
      requesterRole: req.auth!.role,
      requesterUserId: req.auth!.userId,
      targetUserId: payload.userId,
    });

    return res.json(result);
  },
};
