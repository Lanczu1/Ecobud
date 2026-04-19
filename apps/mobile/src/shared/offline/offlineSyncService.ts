import { ecobudApi } from '../api/ecobudApi';
import { offlineMutationQueue } from './offlineMutationQueue';
import type {
  OfflineChallengeProgressPayload,
  OfflineEventJoinPayload,
  OfflineHabitCheckInPayload,
  OfflineLessonMutationPayload,
  OfflineMutationRecord,
} from './offlineMutationQueue.types';

const RETRY_DELAYS_MS = [600, 1_200, 2_400] as const;

interface SyncPendingMutationsInput {
  token: string;
  userId: string;
}

interface SyncPendingMutationsResult {
  attemptedCount: number;
  syncedCount: number;
  failedCount: number;
}

const wait = (durationMs: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, durationMs));

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : 'Unexpected sync failure.';

const isRetryableSyncError = (error: unknown) => {
  if (!(error instanceof Error)) {
    return false;
  }

  const normalizedMessage = error.message.toLowerCase();

  return (
    normalizedMessage.includes('unable to reach the ecobud api') ||
    normalizedMessage.includes('network') ||
    normalizedMessage.includes('fetch') ||
    normalizedMessage.includes('timeout')
  );
};

const executeMutation = async (
  token: string,
  mutation: OfflineMutationRecord,
) => {
  switch (mutation.type) {
    case 'lesson-seen': {
      const payload = mutation.payload as OfflineLessonMutationPayload;
      return ecobudApi.markLessonSeen(token, payload.lessonId);
    }
    case 'lesson-complete': {
      const payload = mutation.payload as OfflineLessonMutationPayload;
      return ecobudApi.completeLesson(token, payload.lessonId);
    }
    case 'challenge-progress': {
      const payload = mutation.payload as OfflineChallengeProgressPayload;
      return ecobudApi.updateChallengeProgress(
        token,
        payload.challengeId,
        payload.progressPercentage,
      );
    }
    case 'habit-check-in': {
      const payload = mutation.payload as OfflineHabitCheckInPayload;
      return ecobudApi.checkInHabit(token, payload.habitId);
    }
    case 'event-join': {
      const payload = mutation.payload as OfflineEventJoinPayload;
      return ecobudApi.joinEvent(token, payload.eventId);
    }
  }
};

export const offlineSyncService = {
  async queueMutation(...args: Parameters<typeof offlineMutationQueue.enqueue>) {
    await offlineMutationQueue.initialize();
    return offlineMutationQueue.enqueue(...args);
  },

  async getPendingCount(userId: string) {
    await offlineMutationQueue.initialize();
    return offlineMutationQueue.getPendingCount(userId);
  },

  async syncPendingMutations(
    input: SyncPendingMutationsInput,
  ): Promise<SyncPendingMutationsResult> {
    await offlineMutationQueue.initialize();
    const pendingMutations = await offlineMutationQueue.listPending(input.userId);

    if (pendingMutations.length === 0) {
      return {
        attemptedCount: 0,
        syncedCount: 0,
        failedCount: 0,
      };
    }

    const result: SyncPendingMutationsResult = {
      attemptedCount: pendingMutations.length,
      syncedCount: 0,
      failedCount: 0,
    };

    for (const mutation of pendingMutations) {
      let synced = false;
      let lastErrorMessage = 'Sync failed.';

      for (let attemptIndex = 0; attemptIndex < RETRY_DELAYS_MS.length; attemptIndex += 1) {
        try {
          await executeMutation(input.token, mutation);
          await offlineMutationQueue.markSynced(mutation.id);
          result.syncedCount += 1;
          synced = true;
          break;
        } catch (error) {
          lastErrorMessage = getErrorMessage(error);

          if (!isRetryableSyncError(error) || attemptIndex === RETRY_DELAYS_MS.length - 1) {
            break;
          }

          await wait(RETRY_DELAYS_MS[attemptIndex]);
        }
      }

      if (!synced) {
        await offlineMutationQueue.markFailed(mutation.id, lastErrorMessage);
        result.failedCount += 1;
      }
    }

    return result;
  },
};
