import { PrismaClient } from '@prisma/client';
import { prisma } from '../prismaClient';

export const ONLINE_ACTIVITY_WINDOW_MS = 5 * 60 * 1000;

export const isUserCurrentlyOnline = (
  lastActionDate: Date | null | undefined,
  now: Date = new Date(),
) => {
  if (!lastActionDate) {
    return false;
  }

  return now.getTime() - lastActionDate.getTime() <= ONLINE_ACTIVITY_WINDOW_MS;
};

export class UserActivityService {
  constructor(private readonly database: PrismaClient = prisma) {}

  async touchUserActivity(userId: string, activityAt: Date = new Date()) {
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

  getOnlineThreshold(now: Date = new Date()) {
    return new Date(now.getTime() - ONLINE_ACTIVITY_WINDOW_MS);
  }
}
