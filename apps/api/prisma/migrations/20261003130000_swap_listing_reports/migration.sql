BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
CREATE TABLE "swap_listing_reports" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "listing_id" TEXT NOT NULL REFERENCES "swap_listings"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "reporter_id" TEXT REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  "report_name" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "occurrences" INTEGER NOT NULL DEFAULT 1 CHECK ("occurrences" > 0),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolved_at" TIMESTAMP(3)
);
CREATE INDEX "swap_listing_reports_listing_id_resolved_at_created_at_idx" ON "swap_listing_reports"("listing_id", "resolved_at", "created_at");
CREATE INDEX "swap_listing_reports_reporter_id_idx" ON "swap_listing_reports"("reporter_id");
CREATE UNIQUE INDEX "swap_listing_reports_active_account_idx" ON "swap_listing_reports"("listing_id", "reporter_id") WHERE "resolved_at" IS NULL AND "reporter_id" IS NOT NULL;

INSERT INTO "swap_listing_reports" ("id", "listing_id", "report_name", "reason", "occurrences", "created_at")
SELECT 'legacy_report_' || "id", "id", 'Earlier report', COALESCE("report_reason", 'No saved reason'), GREATEST("report_count", 1), "updated_at"
FROM "swap_listings" WHERE "is_reported" = TRUE;
ALTER TABLE "swap_listing_reports" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "swap_listing_reports" FROM PUBLIC;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON "swap_listing_reports" FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON "swap_listing_reports" FROM authenticated;
  END IF;
END $$;
COMMIT;
