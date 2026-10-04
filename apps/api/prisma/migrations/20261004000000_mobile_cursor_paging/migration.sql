CREATE INDEX "events_mobile_cursor_idx" ON "Event" ("is_published", "is_featured" DESC, "start_datetime", "id");
CREATE INDEX "history_user_cursor_idx" ON "TransparencyLog" ("userId", "timestamp", "id");
CREATE INDEX "swap_messages_cursor_idx" ON "swap_messages" ("swap_request_id", "timestamp", "id");
