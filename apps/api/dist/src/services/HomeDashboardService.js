"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HomeDashboardService = void 0;
const UserStatsService_1 = require("./UserStatsService");
class HomeDashboardService {
    userStatsService;
    constructor(userStatsService = new UserStatsService_1.UserStatsService()) {
        this.userStatsService = userStatsService;
    }
    async getDashboard(userId) {
        return this.userStatsService.getHomeDashboard(userId);
    }
}
exports.HomeDashboardService = HomeDashboardService;
