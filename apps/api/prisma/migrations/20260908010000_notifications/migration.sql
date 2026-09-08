ALTER TABLE users ADD COLUMN verified_at timestamp(3);
ALTER TABLE "Event" ADD COLUMN is_published boolean NOT NULL DEFAULT true;
ALTER TABLE notifications ADD COLUMN type text NOT NULL DEFAULT 'system', ADD COLUMN priority text NOT NULL DEFAULT 'low', ADD COLUMN related_id text, ADD COLUMN related_type text, ADD COLUMN notification_key text, ADD COLUMN read_at timestamp(3);
CREATE UNIQUE INDEX notifications_user_key ON notifications(user_id, notification_key);
CREATE INDEX notifications_user_created ON notifications(user_id, created_at DESC);
CREATE TABLE notification_events (key text PRIMARY KEY, type text NOT NULL, related_id text NOT NULL, title text NOT NULL, message text NOT NULL, user_id text REFERENCES users(id) ON DELETE CASCADE, created_at timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, available_at timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, cursor text, completed boolean NOT NULL DEFAULT false);
CREATE TABLE notification_devices (token text PRIMARY KEY, user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE, session_version integer NOT NULL, updated_at timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE INDEX notification_devices_user ON notification_devices(user_id);
CREATE TABLE notification_deliveries (id text PRIMARY KEY, notification_id text NOT NULL REFERENCES notifications(id) ON DELETE CASCADE, channel text NOT NULL, destination text NOT NULL, state text NOT NULL DEFAULT 'pending', attempts integer NOT NULL DEFAULT 0, next_at timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, receipt text, UNIQUE(notification_id,channel,destination));
CREATE INDEX notification_delivery_pending ON notification_deliveries(state,next_at);
ALTER TABLE notification_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_deliveries ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON notification_events,notification_devices,notification_deliveries FROM PUBLIC, anon, authenticated;
-- Existing notifications RLS policies are deliberately preserved. Clients use the authenticated API.
CREATE FUNCTION ecobud_notification_event() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE kind text; visible boolean; old_visible boolean := false; event_key text; heading text; body text; available timestamp(3) := CURRENT_TIMESTAMP;
BEGIN
  IF TG_TABLE_NAME = 'users' THEN
    IF NEW.verified_at IS NULL OR NEW.status::text <> 'active' OR NEW.role::text <> 'user' THEN RETURN NEW; END IF;
    IF TG_OP = 'UPDATE' THEN RETURN NEW; END IF;
    kind := 'verification'; heading := 'Welcome to ECOBUD!'; body := 'Your ECOBUD account has been successfully verified. Welcome to ECOBUD!';
    event_key := 'verification_completed:' || NEW.id;
  ELSE
    IF TG_TABLE_NAME = 'lessons' THEN
      kind := 'learning'; visible := NEW.is_published;
      IF TG_OP = 'UPDATE' THEN old_visible := OLD.is_published; END IF;
      heading := 'New learning module'; body := 'New learning module available: ' || NEW.title || '.';
    ELSIF TG_TABLE_NAME = 'Challenge' THEN
      kind := 'challenge'; visible := NEW.active AND (NEW."endDate" IS NULL OR NEW."endDate" > CURRENT_TIMESTAMP); available := GREATEST(CURRENT_TIMESTAMP, NEW."startDate");
      IF TG_OP = 'UPDATE' THEN old_visible := OLD.active; END IF;
      heading := 'New Eco Challenge'; body := NEW.title || '. Complete it and earn EXP and Eco-Coins!';
    ELSE
      kind := 'event'; visible := NEW.is_published; IF TG_OP = 'UPDATE' THEN old_visible := OLD.is_published; END IF;
      heading := 'New Eco Event'; body := 'New Eco Event: ' || NEW.title || ' is now available.';
    END IF;
    IF NOT visible OR old_visible THEN RETURN NEW; END IF;
    event_key := kind || '_published:' || NEW.id;
  END IF;
  INSERT INTO notification_events(key,type,related_id,title,message,user_id,available_at) VALUES(event_key,kind,NEW.id,heading,body,CASE WHEN kind='verification' THEN NEW.id ELSE NULL END,available) ON CONFLICT DO NOTHING;
  RETURN NEW;
END $$;
CREATE TRIGGER notification_lesson AFTER INSERT OR UPDATE ON lessons FOR EACH ROW EXECUTE FUNCTION ecobud_notification_event();
CREATE TRIGGER notification_challenge AFTER INSERT OR UPDATE ON "Challenge" FOR EACH ROW EXECUTE FUNCTION ecobud_notification_event();
CREATE TRIGGER notification_event AFTER INSERT OR UPDATE ON "Event" FOR EACH ROW EXECUTE FUNCTION ecobud_notification_event();
CREATE TRIGGER notification_verified AFTER INSERT ON users FOR EACH ROW EXECUTE FUNCTION ecobud_notification_event();
-- Baseline existing visible content so later edits or visibility toggles do not announce it as new.
INSERT INTO notification_events(key,type,related_id,title,message,completed) SELECT 'learning_published:'||id,'learning',id,title,'',true FROM lessons WHERE is_published ON CONFLICT DO NOTHING;
INSERT INTO notification_events(key,type,related_id,title,message,completed) SELECT 'challenge_published:'||id,'challenge',id,title,'',true FROM "Challenge" WHERE active ON CONFLICT DO NOTHING;
INSERT INTO notification_events(key,type,related_id,title,message,completed) SELECT 'event_published:'||id,'event',id,title,'',true FROM "Event" WHERE is_published ON CONFLICT DO NOTHING;
REVOKE ALL ON FUNCTION ecobud_notification_event() FROM PUBLIC, anon, authenticated;


