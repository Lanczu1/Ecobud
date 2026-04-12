import { prisma } from "../prismaClient";

export class AdminService {
  static async getAllLessons() {
    return await prisma.lesson.findMany({
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

  static async createLesson(data: {
    title: string;
    description: string;
    content: string;
    isPublished: boolean;
    createdById: string;
    category: string;
  }) {
    return await prisma.lesson.create({
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

  static async updateLesson(id: string, data: Partial<{
    title: string;
    description: string;
    content: string;
    isPublished: boolean;
  }>) {
    return await prisma.lesson.update({
      where: { id },
      data
    });
  }

  static async deleteLesson(id: string) {
    return await prisma.lesson.delete({
      where: { id }
    });
  }

  static async togglePublish(id: string, isPublished: boolean) {
    return await prisma.lesson.update({
      where: { id },
      data: { isPublished }
    });
  }

  static async resetUserKnowledge(userId: string) {
    return await prisma.userStats.update({
      where: { userId },
      data: { knowledgePoints: 0 }
    });
  }

  static async getUsers() {
    return await prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        points: true,
        currentStreak: true,
        createdAt: true,
        profile: {
          select: {
            displayName: true,
            avatarUrl: true
          }
        }
      }
    });
  }

  // Challenge Management
  static async getAllChallenges() {
    return await prisma.challenge.findMany({
      orderBy: { createdAt: 'desc' }
    });
  }

  static async createChallenge(data: {
    title: string;
    description: string;
    difficulty: string;
    durationDays: number;
    pointsReward: number;
    category?: string;
    active?: boolean;
    imageUrl?: string;
    badgeLabel?: string;
  }) {
    return await prisma.challenge.create({
      data: {
        title: data.title,
        description: data.description,
        difficulty: data.difficulty,
        durationDays: data.durationDays,
        pointsReward: data.pointsReward,
        category: data.category || "General",
        active: data.active ?? true,
        imageUrl: data.imageUrl,
        badgeLabel: data.badgeLabel
      }
    });
  }

  static async updateChallenge(id: string, data: any) {
    return await prisma.challenge.update({
      where: { id },
      data
    });
  }

  static async deleteChallenge(id: string) {
    return await prisma.challenge.delete({
      where: { id }
    });
  }
}
