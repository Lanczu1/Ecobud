ALTER TABLE admin_notification_reads ADD COLUMN IF NOT EXISTS dismissed_at timestamp(3);
