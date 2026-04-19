export type OfflineMutationType =
  | 'lesson-seen'
  | 'lesson-complete'
  | 'challenge-progress'
  | 'habit-check-in'
  | 'event-join';

export interface OfflineLessonMutationPayload {
  lessonId: string;
}

export interface OfflineChallengeProgressPayload {
  challengeId: string;
  progressPercentage: number;
}

export interface OfflineHabitCheckInPayload {
  habitId: string;
  dateKey: string;
}

export interface OfflineEventJoinPayload {
  eventId: string;
}

export interface OfflineMutationPayloadMap {
  'lesson-seen': OfflineLessonMutationPayload;
  'lesson-complete': OfflineLessonMutationPayload;
  'challenge-progress': OfflineChallengeProgressPayload;
  'habit-check-in': OfflineHabitCheckInPayload;
  'event-join': OfflineEventJoinPayload;
}

export type OfflineMutationPayload =
  OfflineMutationPayloadMap[OfflineMutationType];

export interface OfflineMutationRecord<TType extends OfflineMutationType = OfflineMutationType> {
  id: string;
  userId: string;
  type: TType;
  payload: OfflineMutationPayloadMap[TType];
  dedupeKey: string | null;
  synced: 0 | 1;
  retryCount: number;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateOfflineMutationInput<
  TType extends OfflineMutationType = OfflineMutationType,
> {
  userId: string;
  type: TType;
  payload: OfflineMutationPayloadMap[TType];
  dedupeKey?: string | null;
}

export interface OfflineMutationQueue {
  initialize(): Promise<void>;
  enqueue<TType extends OfflineMutationType>(
    input: CreateOfflineMutationInput<TType>,
  ): Promise<OfflineMutationRecord<TType>>;
  listPending(userId: string): Promise<OfflineMutationRecord[]>;
  markSynced(id: string): Promise<void>;
  markFailed(id: string, errorMessage: string): Promise<void>;
  getPendingCount(userId: string): Promise<number>;
}
