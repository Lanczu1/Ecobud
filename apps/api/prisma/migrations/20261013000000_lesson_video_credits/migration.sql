ALTER TABLE "lessons"
  ADD COLUMN "video_credits_enabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "video_credits_name" TEXT,
  ADD COLUMN "video_credits_url" TEXT;
