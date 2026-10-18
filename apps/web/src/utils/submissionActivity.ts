export interface SubmissionActivity {
  id: string;
  createdAt: string;
  submittedAt?: string;
}

// When the resident last sent a photo; reviews do not move it.
export function submissionActivityAt(submission: SubmissionActivity): string {
  return submission.submittedAt && Number.isFinite(Date.parse(submission.submittedAt)) ? submission.submittedAt : submission.createdAt;
}

export function latestSubmissionFirst(a: SubmissionActivity, b: SubmissionActivity): number {
  return Date.parse(submissionActivityAt(b)) - Date.parse(submissionActivityAt(a))
    || Date.parse(b.createdAt) - Date.parse(a.createdAt) || b.id.localeCompare(a.id);
}
