CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS "users_name_trgm_idx" ON "users" USING GIN ("name" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "users_email_trgm_idx" ON "users" USING GIN ("email" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "profile_display_name_trgm_idx" ON "Profile" USING GIN ("displayName" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "profile_city_trgm_idx" ON "Profile" USING GIN ("city" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "lessons_title_trgm_idx" ON "lessons" USING GIN ("title" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "challenge_title_trgm_idx" ON "Challenge" USING GIN ("title" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "event_title_trgm_idx" ON "Event" USING GIN ("title" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "redeem_items_title_trgm_idx" ON "redeem_items" USING GIN ("title" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "swap_listings_title_trgm_idx" ON "swap_listings" USING GIN ("title" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "swap_listings_looking_for_trgm_idx" ON "swap_listings" USING GIN ("looking_for" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "swap_listings_description_trgm_idx" ON "swap_listings" USING GIN ("description" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "redeem_requests_user_name_trgm_idx" ON "redeem_requests" USING GIN ("user_name" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "redeem_requests_item_title_trgm_idx" ON "redeem_requests" USING GIN ("item_title" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "audit_logs_action_timestamp_idx" ON "audit_logs" ("action", "timestamp");

CREATE INDEX IF NOT EXISTS "announcements_barangays_gin" ON "announcements" USING GIN ("barangays");
CREATE INDEX IF NOT EXISTS "admin_notifications_barangays" ON "admin_notification_events" USING GIN ("barangays");
