BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
CREATE TABLE "swap_listing_ratings" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "listing_id" TEXT NOT NULL REFERENCES "swap_listings"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "user_id" TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "stars" INTEGER NOT NULL CHECK ("stars" BETWEEN 1 AND 5),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "swap_listing_ratings_listing_id_user_id_key" ON "swap_listing_ratings"("listing_id", "user_id");
CREATE INDEX "swap_listing_ratings_user_id_idx" ON "swap_listing_ratings"("user_id");
ALTER TABLE "swap_listing_ratings" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "swap_listing_ratings" FROM PUBLIC;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON "swap_listing_ratings" FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON "swap_listing_ratings" FROM authenticated;
  END IF;
END $$;
COMMIT;
