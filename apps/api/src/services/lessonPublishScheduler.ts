import { prisma } from '../prismaClient';
import { supabaseRealtimeService } from './supabaseRealtimeService';

const PUBLISH_CHECK_INTERVAL_MS = 60 * 1000; // 1 minute

let publishInterval: NodeJS.Timeout | null = null;
let publishInFlight = false;

const runPublishTick = async () => {
  if (publishInFlight) {
    return;
  }

  publishInFlight = true;

  try {
    const lessonsToPublish = await prisma.lesson.findMany({
      where: {
        isPublished: false,
        scheduledAt: { lte: new Date() }
      }
    });

    for (const lesson of lessonsToPublish) {
      await prisma.lesson.update({
        where: { id: lesson.id },
        data: { isPublished: true, scheduledAt: null } // Clear scheduledAt so it's not checked again
      });

      await Promise.all([
        supabaseRealtimeService.publishGlobalSectionRefresh('learn', {
          actorRole: 'admin',
          entityId: lesson.id,
          reason: 'lesson-auto-published',
        }),
        supabaseRealtimeService.publishAdminSectionRefresh('dashboard', {
          actorRole: 'admin',
          entityId: lesson.id,
          reason: 'lesson-auto-published',
        }),
      ]);
      console.log(`Auto-published lesson: ${lesson.title}`);
    }
  } catch (error) {
    console.error('Lesson publish check tick failed.', error);
  } finally {
    publishInFlight = false;
  }
};

export const startLessonPublishScheduler = () => {
  if (publishInterval) {
    return publishInterval;
  }

  publishInterval = setInterval(() => {
    void runPublishTick();
  }, PUBLISH_CHECK_INTERVAL_MS);

  void runPublishTick();

  return publishInterval;
};

export const stopLessonPublishScheduler = () => {
  if (!publishInterval) {
    return;
  }

  clearInterval(publishInterval);
  publishInterval = null;
};
