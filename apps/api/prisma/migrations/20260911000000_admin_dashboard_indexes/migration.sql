-- Supports the admin dashboard's role-filtered totals and seven-day activity trend.
CREATE INDEX "users_role_created_at_idx" ON "users"("role", "created_at");
CREATE INDEX "users_role_last_action_date_idx" ON "users"("role", "last_action_date");
CREATE INDEX "lesson_progress_created_at_idx" ON "lesson_progress"("created_at");
CREATE INDEX "lesson_progress_updated_at_idx" ON "lesson_progress"("updated_at");
CREATE INDEX "challenge_submissions_status_idx" ON "ChallengeSubmission"("status");
CREATE INDEX "challenge_submissions_created_at_idx" ON "ChallengeSubmission"("created_at");
CREATE INDEX "challenge_submissions_updated_at_idx" ON "ChallengeSubmission"("updated_at");
CREATE INDEX "habit_check_ins_created_at_idx" ON "HabitCheckIn"("createdAt");
CREATE INDEX "presence_sessions_updated_at_idx" ON "presence_sessions"("updated_at");
