"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserActivityService = exports.isUserCurrentlyOnline = exports.ONLINE_ACTIVITY_WINDOW_MS = void 0;
const prismaClient_1 = require("../prismaClient");
exports.ONLINE_ACTIVITY_WINDOW_MS = 5 * 60 * 1000;
const isUserCurrentlyOnline = (lastActionDate, now = new Date()) => {
    if (!lastActionDate) {
        return false;
    }
    return now.getTime() - lastActionDate.getTime() <= exports.ONLINE_ACTIVITY_WINDOW_MS;
};
exports.isUserCurrentlyOnline = isUserCurrentlyOnline;
class UserActivityService {
    database;
    constructor(database = prismaClient_1.prisma) {
        this.database = database;
    }
    async touchUserActivity(userId, activityAt = new Date()) {
        return this.database.user.update({
            where: { id: userId },
            data: {
                lastActionDate: activityAt,
            },
            select: {
                id: true,
                lastActionDate: true,
            },
        });
    }
    getOnlineThreshold(now = new Date()) {
        return new Date(now.getTime() - exports.ONLINE_ACTIVITY_WINDOW_MS);
    }
}
exports.UserActivityService = UserActivityService;
