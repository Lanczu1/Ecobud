-- Speeds up the active-user leaderboard filter and its points/date ordering.
CREATE INDEX "users_leaderboard_order_idx"
ON "users"("status", "role", "points" DESC, "created_at" ASC);
