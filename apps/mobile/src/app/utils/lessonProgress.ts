export function getVideoProgressLimit(hasQuiz: boolean, pageCount = 0): number {
  return pageCount > 0 ? 70 : (hasQuiz ? 80 : 99);
}

/**
 * Native players can report a zero duration for longer MP4s until their
 * metadata is fully available. The admin-provided duration keeps learning
 * progress working while that metadata is delayed or unavailable.
 */
export function getVideoDurationForProgress(playerDuration: number, durationMinutes?: number): number {
  if (Number.isFinite(playerDuration) && playerDuration > 0) return playerDuration;

  const fallbackDuration = (durationMinutes ?? 0) * 60;
  return Number.isFinite(fallbackDuration) && fallbackDuration > 0 ? fallbackDuration : 0;
}

export function getVideoLessonProgress(timestamp: number, duration: number, hasQuiz: boolean, pageCount = 0): number {
  if (!Number.isFinite(timestamp) || !Number.isFinite(duration) || duration <= 0) return 0;
  const limit = getVideoProgressLimit(hasQuiz, pageCount);
  return Math.floor(Math.min(1, Math.max(0, timestamp / duration)) * limit);
}
export function getQuizLessonProgress(completedQuestions: number, questionCount: number): number {
  if (questionCount <= 0) return 80;
  return Math.min(99, 80 + Math.floor(Math.min(questionCount, Math.max(0, completedQuestions)) / questionCount * 20));
}

export function isLocalLessonProgressNewer(localSavedAt: number, serverUpdatedAt?: string): boolean {
  if (!Number.isFinite(localSavedAt)) return false;
  if (!serverUpdatedAt) return true;

  const serverSavedAt = Date.parse(serverUpdatedAt);
  return !Number.isFinite(serverSavedAt) || localSavedAt > serverSavedAt;
}
