"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.learnController = void 0;
const zod_1 = require("zod");
const LearnService_1 = require("../services/LearnService");
const learnService = new LearnService_1.LearnService();
const lessonActionSchema = zod_1.z.object({
    lessonId: zod_1.z.string().min(1),
});
exports.learnController = {
    async getLessons(req, res) {
        const lessons = await learnService.getPublishedLessons(req.auth.userId);
        return res.json(lessons);
    },
    async markSeen(req, res) {
        const { lessonId } = lessonActionSchema.parse(req.body);
        const result = await learnService.markLessonSeen(req.auth.userId, lessonId);
        return res.json(result);
    },
    async completeLesson(req, res) {
        const { lessonId } = lessonActionSchema.parse(req.body);
        const result = await learnService.completeLesson(req.auth.userId, lessonId);
        return res.json(result);
    },
};
