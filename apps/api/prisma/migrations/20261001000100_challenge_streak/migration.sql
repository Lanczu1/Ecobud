ALTER TABLE "users"
  ADD COLUMN "last_challenge_at" TIMESTAMP(3),
  ADD COLUMN "streak_restored_at" TIMESTAMP(3),
  ADD COLUMN "streak_restore_month" TEXT,
  ADD COLUMN "streak_restores_used" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "StreakMilestone" (
  "userId" TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "challenges" INTEGER NOT NULL,
  "awardedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("userId", "challenges")
);

ALTER TABLE "StreakMilestone" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "StreakMilestone" FROM PUBLIC;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON "StreakMilestone" FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON "StreakMilestone" FROM authenticated;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ecobud_backend') THEN
    GRANT SELECT, INSERT, UPDATE ON "StreakMilestone" TO ecobud_backend;
    CREATE POLICY ecobud_backend_streak_milestones ON "StreakMilestone"
      FOR ALL TO ecobud_backend USING (true) WITH CHECK (true);
  END IF;
END $$;

UPDATE "users" SET "streak_count" = 0;
UPDATE "users" u SET "streak_count" = c.total, "last_challenge_at" = c.latest
FROM (
  SELECT "userId", COUNT(*)::INTEGER AS total, MAX("completedAt") AS latest
  FROM "UserChallenge" WHERE "status" = 'COMPLETED' GROUP BY "userId"
) c WHERE u.id = c."userId";
UPDATE "user_stats" s SET "current_streak" = u."streak_count" FROM "users" u WHERE s."user_id" = u.id;
