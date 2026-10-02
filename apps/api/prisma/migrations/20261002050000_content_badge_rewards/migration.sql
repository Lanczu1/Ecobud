ALTER TABLE "Badge"
  ADD COLUMN "awardType" TEXT NOT NULL DEFAULT 'points',
  ADD COLUMN "active" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "lessonId" TEXT,
  ADD COLUMN "challengeId" TEXT,
  ADD COLUMN "eventId" TEXT,
  ADD COLUMN "swapListingId" TEXT;
CREATE UNIQUE INDEX "Badge_lessonId_key" ON "Badge"("lessonId");
CREATE UNIQUE INDEX "Badge_challengeId_key" ON "Badge"("challengeId");
CREATE UNIQUE INDEX "Badge_eventId_key" ON "Badge"("eventId");
CREATE UNIQUE INDEX "Badge_swapListingId_key" ON "Badge"("swapListingId");
ALTER TABLE "Badge" ADD CONSTRAINT "Badge_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "lessons"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Badge" ADD CONSTRAINT "Badge_challengeId_fkey" FOREIGN KEY ("challengeId") REFERENCES "Challenge"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Badge" ADD CONSTRAINT "Badge_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Badge" ADD CONSTRAINT "Badge_swapListingId_fkey" FOREIGN KEY ("swapListingId") REFERENCES "swap_listings"("id") ON DELETE SET NULL ON UPDATE CASCADE;
UPDATE "Badge" SET "awardType" = 'giveaway_milestone' WHERE "name" = 'Giveaway Master';
