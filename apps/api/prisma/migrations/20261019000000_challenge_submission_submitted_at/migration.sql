-- When the resident last sent a photo for the submission. Unlike updated_at, a moderator review does not move it.
ALTER TABLE "ChallengeSubmission"
  ADD COLUMN "submitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Existing rows: the After photo time was never stored. A submission still waiting in final_review
-- has not been touched since its After photo arrived, so updated_at is that time; every other row
-- falls back to when the Before photo was sent.
UPDATE "ChallengeSubmission"
SET "submitted_at" = CASE
  WHEN "afterProofUrl" IS NOT NULL AND "status" = 'final_review' THEN "updated_at"
  ELSE "created_at"
END;

CREATE INDEX "challenge_submissions_submitted_at_idx" ON "ChallengeSubmission"("submitted_at");
