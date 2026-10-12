import { ecobudApi } from '../api/ecobudApi';
import { offlineMutationQueue } from './offlineMutationQueue';
import type {
  OfflineChallengeProgressPayload,
  OfflineEventJoinPayload,
  OfflineHabitCheckInPayload,
  OfflineLessonMutationPayload,
  OfflineMutationRecord,
  OfflineMutationType,
  OfflineRedeemItemPayload,
} from './offlineMutationQueue.types';

const RETRY_DELAYS_MS = [600, 1_200, 2_400] as const;
const MAX_SYNC_PASSES_PER_MUTATION = 5;

interface SyncPendingMutationsInput {
  token: string;
  userId: string;
}

export interface RejectedOfflineMutation {
  type: OfflineMutationType;
  message: string;
}

interface SyncPendingMutationsResult {
  attemptedCount: number;
  syncedCount: number;
  failedCount: number;
  remainingCount: number;
  rejected: RejectedOfflineMutation[];
}

type SyncFailureKind = 'connectivity' | 'auth' | 'server' | 'rejected';

const wait = (durationMs: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, durationMs));

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : 'Unexpected sync failure.';

const classifySyncError = (error: unknown): SyncFailureKind => {
  const code = (error as { code?: string } | null)?.code;
  const status = (error as { status?: number } | null)?.status;

  if (code === 'offline' || code === 'timeout') {
    return 'connectivity';
  }

  if (status === 401) {
    return 'auth';
  }

  if (typeof status === 'number' && status >= 400 && status < 500 && status !== 408 && status !== 429) {
    return 'rejected';
  }

  return 'server';
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
    case 'redeem-item': {
      const payload = mutation.payload as OfflineRedeemItemPayload;
      try {
        return await ecobudApi.redeemItem(token, payload.itemId);
      } catch (error) {
        const message = error instanceof Error ? error.message.toLowerCase() : '';
        if (message.includes('active request') || message.includes('pending request')) {
          return { success: true, alreadyRequested: true };
        }
        throw error;
      }
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

    const result: SyncPendingMutationsResult = {
      attemptedCount: 0,
      syncedCount: 0,
      failedCount: 0,
      remainingCount: 0,
      rejected: [],
    };

    for (const mutation of pendingMutations) {
      let failureKind: SyncFailureKind | null = null;
      let lastErrorMessage = 'Sync failed.';

      result.attemptedCount += 1;

      for (let attemptIndex = 0; attemptIndex < RETRY_DELAYS_MS.length; attemptIndex += 1) {
        try {
          await executeMutation(input.token, mutation);
          await offlineMutationQueue.markSynced(mutation.id);
          result.syncedCount += 1;
          failureKind = null;
          break;
        } catch (error) {
          lastErrorMessage = getErrorMessage(error);
          failureKind = classifySyncError(error);

          if (failureKind !== 'connectivity' || attemptIndex === RETRY_DELAYS_MS.length - 1) {
            break;
          }

          await wait(RETRY_DELAYS_MS[attemptIndex]);
        }
      }

      if (!failureKind) {
        continue;
      }

      // The connection or the token is unusable for every remaining item, so
      // leave the queue untouched and let the next sync trigger pick it up.
      if (failureKind === 'connectivity' || failureKind === 'auth') {
        result.attemptedCount -= 1;
        break;
      }

      const outOfPasses = mutation.retryCount + 1 >= MAX_SYNC_PASSES_PER_MUTATION;

      if (failureKind === 'rejected' || outOfPasses) {
        await offlineMutationQueue.discard(mutation.id);
        result.rejected.push({ type: mutation.type, message: lastErrorMessage });
        continue;
      }

      await offlineMutationQueue.markFailed(mutation.id, lastErrorMessage);
      result.failedCount += 1;
    }

    result.remainingCount = await offlineMutationQueue.getPendingCount(input.userId);

    return result;
  },
};
