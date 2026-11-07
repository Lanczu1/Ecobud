-- Event QR codes used to stay valid until an hour after the event ended, which could be weeks away.
-- Codes now last 24 hours from creation, so cap the ones already issued to the same limit.
UPDATE "event_qr_codes"
SET "expires_at" = "created_at" + INTERVAL '24 hours'
WHERE "expires_at" > "created_at" + INTERVAL '24 hours';
