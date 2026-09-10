export function getVideoProgressLimit(hasQuiz: boolean, pageCount = 0): number {
  return pageCount > 0 ? 70 : (hasQuiz ? 80 : 99);
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
