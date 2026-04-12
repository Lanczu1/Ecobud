import { UserStatsService } from './UserStatsService';

export class HomeDashboardService {
  constructor(private readonly userStatsService = new UserStatsService()) {}

  async getDashboard(userId: string) {
    return this.userStatsService.getHomeDashboard(userId);
  }
}
