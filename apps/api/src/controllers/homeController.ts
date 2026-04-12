import { Response } from 'express';
import { AuthenticatedRequest } from '../http/authentication';
import { HomeDashboardService } from '../services/HomeDashboardService';

const homeDashboardService = new HomeDashboardService();

export const homeController = {
  async getDashboard(req: AuthenticatedRequest, res: Response) {
    const payload = await homeDashboardService.getDashboard(req.auth!.userId);
    return res.json(payload);
  },
};
