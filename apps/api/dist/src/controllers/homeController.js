"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.homeController = void 0;
const HomeDashboardService_1 = require("../services/HomeDashboardService");
const homeDashboardService = new HomeDashboardService_1.HomeDashboardService();
exports.homeController = {
    async getDashboard(req, res) {
        const payload = await homeDashboardService.getDashboard(req.auth.userId);
        return res.json(payload);
    },
};
