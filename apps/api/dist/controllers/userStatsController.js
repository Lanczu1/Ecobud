"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.userStatsController = void 0;
const zod_1 = require("zod");
const UserStatsService_1 = require("../services/UserStatsService");
const userStatsService = new UserStatsService_1.UserStatsService();
const resetKnowledgeSchema = zod_1.z.object({
    userId: zod_1.z.string().min(1).optional(),
});
exports.userStatsController = {
    async resetKnowledgePoints(req, res) {
        const payload = resetKnowledgeSchema.parse(req.body ?? {});
        const result = await userStatsService.resetKnowledgePoints({
            requesterRole: req.auth.role,
            requesterUserId: req.auth.userId,
            targetUserId: payload.userId,
        });
        return res.json(result);
    },
};
