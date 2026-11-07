-- How many of the listing's items the requester asked for. A completed exchange takes this many off the listing.
ALTER TABLE "swap_requests"
  ADD COLUMN "quantity" INTEGER NOT NULL DEFAULT 1;

-- Completed exchanges used to close a listing for good, and nothing recorded how many items left.
-- Mark those listings as fully given away so they stay off Browse now that only a zero quantity hides them.
UPDATE "swap_listings" l
SET "quantity" = '0'
WHERE EXISTS (SELECT 1 FROM "swap_requests" r WHERE r."listing_id" = l."id" AND r."status" = 'completed');
