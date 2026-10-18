export interface SubmissionActivity {
  id: string;
  createdAt: string;
  updatedAt?: string;
}

export function submissionActivityAt(submission: SubmissionActivity): string {
  return submission.updatedAt && Number.isFinite(Date.parse(submission.updatedAt)) ? submission.updatedAt : submission.createdAt;
}

export function latestSubmissionFirst(a: SubmissionActivity, b: SubmissionActivity): number {
  return Date.parse(submissionActivityAt(b)) - Date.parse(submissionActivityAt(a))
    || Date.parse(b.createdAt) - Date.parse(a.createdAt) || b.id.localeCompare(a.id);
}
