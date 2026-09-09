export function getVideoLessonProgress(timestamp: number, duration: number, hasQuiz: boolean): number {
  if (!Number.isFinite(timestamp) || !Number.isFinite(duration) || duration <= 0) return 0;
  const limit = hasQuiz ? 80 : 99;
  return Math.floor(Math.min(1, Math.max(0, timestamp / duration)) * limit);
}

export function getQuizLessonProgress(questionIndex: number, questionCount: number): number {
  if (questionCount <= 0) return 80;
  return Math.min(99, 80 + Math.floor(Math.max(0, questionIndex) / questionCount * 20));
}
