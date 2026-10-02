BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

CREATE INDEX notification_events_ready ON notification_events(available_at, created_at) WHERE NOT completed;
CREATE INDEX announcements_barangays_gin ON announcements USING GIN(barangays);
CREATE INDEX announcements_feed_order ON announcements(status, priority, "publishAt" DESC);

CREATE FUNCTION ecobud_announcement_notification() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE event_key text := 'announcement_published:' || NEW.id;
BEGIN
  IF NEW.status NOT IN ('Published', 'Scheduled') OR (NEW."expiresAt" IS NOT NULL AND NEW."expiresAt" <= CURRENT_TIMESTAMP) THEN
    DELETE FROM notification_events WHERE key=event_key AND NOT completed AND cursor IS NULL;
    UPDATE notification_events SET completed=true WHERE key=event_key AND NOT completed;
    RETURN NEW;
  END IF;
  INSERT INTO notification_events(key,type,related_id,title,message,available_at)
    VALUES(event_key,'announcement',NEW.id,'New announcement',NEW.title,
      CASE WHEN NEW.status='Scheduled' THEN NEW."publishAt" ELSE COALESCE(NEW."publishAt",CURRENT_TIMESTAMP) END)
    ON CONFLICT(key) DO UPDATE SET title=EXCLUDED.title,message=EXCLUDED.message,available_at=EXCLUDED.available_at
      WHERE NOT notification_events.completed AND notification_events.cursor IS NULL;
  RETURN NEW;
END $$;
CREATE TRIGGER notification_announcement AFTER INSERT OR UPDATE ON announcements FOR EACH ROW EXECUTE FUNCTION ecobud_announcement_notification();
ALTER TABLE announcements DISABLE TRIGGER notification_announcement;
REVOKE ALL ON FUNCTION ecobud_announcement_notification() FROM PUBLIC, anon, authenticated;

INSERT INTO notification_events(key,type,related_id,title,message,available_at,completed)
  SELECT 'announcement_published:'||id,'announcement',id,'New announcement',title,
    COALESCE("publishAt",CURRENT_TIMESTAMP),true
  FROM announcements WHERE status IN ('Published','Scheduled')
  ON CONFLICT DO NOTHING;

COMMIT;

