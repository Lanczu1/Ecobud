"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminService = void 0;
const prismaClient_1 = require("../prismaClient");
class AdminService {
    static async getAllLessons() {
        return await prismaClient_1.prisma.lesson.findMany({
            orderBy: { createdAt: 'desc' },
            include: {
                createdBy: {
                    select: {
                        id: true,
                        name: true,
                        email: true
                    }
                }
            }
        });
    }
    static async createLesson(data) {
        return await prismaClient_1.prisma.lesson.create({
            data: {
                title: data.title,
                description: data.description,
                content: data.content,
                isPublished: data.isPublished,
                createdById: data.createdById,
                category: data.category || "General"
            }
        });
    }
    static async updateLesson(id, data) {
        return await prismaClient_1.prisma.lesson.update({
            where: { id },
            data
        });
    }
    static async deleteLesson(id) {
        return await prismaClient_1.prisma.lesson.delete({
            where: { id }
        });
    }
    static async togglePublish(id, isPublished) {
        return await prismaClient_1.prisma.lesson.update({
            where: { id },
            data: { isPublished }
        });
    }
    static async resetUserKnowledge(userId) {
        return await prismaClient_1.prisma.userStats.update({
            where: { userId },
            data: { knowledgePoints: 0 }
        });
    }
}
exports.AdminService = AdminService;
