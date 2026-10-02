ALTER TABLE "announcements" ADD COLUMN "images" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
UPDATE "announcements" SET "images" = ARRAY["image"] WHERE "image" IS NOT NULL;
