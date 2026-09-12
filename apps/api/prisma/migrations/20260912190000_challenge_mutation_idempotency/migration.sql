ALTER TABLE "ChallengeSubmission"
  ADD COLUMN "submission_request_key" TEXT,
  ADD COLUMN "after_photo_request_key" TEXT,
  ADD COLUMN "claim_request_key" TEXT;

CREATE UNIQUE INDEX "ChallengeSubmission_submission_request_key_key"
  ON "ChallengeSubmission"("submission_request_key");
CREATE UNIQUE INDEX "ChallengeSubmission_after_photo_request_key_key"
  ON "ChallengeSubmission"("after_photo_request_key");
CREATE UNIQUE INDEX "ChallengeSubmission_claim_request_key_key"
  ON "ChallengeSubmission"("claim_request_key");
