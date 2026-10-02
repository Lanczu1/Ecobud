ALTER TABLE "Badge" ADD COLUMN "targetCount" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN "bonusPoints" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Badge" ADD CONSTRAINT "Badge_targetCount_positive" CHECK ("targetCount" > 0),
ADD CONSTRAINT "Badge_bonusPoints_nonnegative" CHECK ("bonusPoints" >= 0);

UPDATE "Badge" SET "awardType" = rules.type, "targetCount" = rules.target,
"bonusPoints" = rules.bonus, "requiredPoints" = 2147483647
FROM (VALUES
  ('Eco Learning Explorer', 'lessons_completed', 5, 50),
  ('Eco Knowledge Builder', 'lessons_completed', 10, 100),
  ('Eco Action Achiever', 'challenges_completed', 5, 100),
  ('Community Regular', 'events_completed', 3, 75),
  ('Swap Partner', 'swaps_completed', 5, 100)
) AS rules(name, type, target, bonus)
WHERE "Badge"."name" = rules.name AND "Badge"."awardType" = 'points'
AND "lessonId" IS NULL AND "challengeId" IS NULL AND "eventId" IS NULL AND "swapListingId" IS NULL;
