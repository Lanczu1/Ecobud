CREATE TABLE admin_notification_events (
  id text PRIMARY KEY DEFAULT md5(random()::text || clock_timestamp()::text),
  event_key text NOT NULL UNIQUE,
  category text NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  record_type text NOT NULL,
  record_id text NOT NULL,
  barangays text[] NOT NULL DEFAULT '{}',
  audience text NOT NULL DEFAULT 'both' CHECK (audience IN ('both','admin','moderator')),
  action_required boolean NOT NULL DEFAULT false,
  resolved_at timestamp(3),
  available_at timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX admin_notifications_feed ON admin_notification_events(available_at DESC,id DESC);
CREATE INDEX admin_notifications_record ON admin_notification_events(record_type,record_id);
CREATE INDEX admin_notifications_barangays ON admin_notification_events USING gin(barangays);
CREATE TABLE admin_notification_reads (
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_id text NOT NULL REFERENCES admin_notification_events(id) ON DELETE CASCADE,
  read_at timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(user_id,event_id)
);
CREATE TABLE admin_notification_preferences (
  user_id text PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  push_categories text[] NOT NULL DEFAULT ARRAY['system'],
  quiet_start integer CHECK (quiet_start BETWEEN 0 AND 23),
  quiet_end integer CHECK (quiet_end BETWEEN 0 AND 23)
);
CREATE TABLE admin_push_subscriptions (
  id text PRIMARY KEY DEFAULT md5(random()::text || clock_timestamp()::text),
  endpoint text NOT NULL UNIQUE,
  subscription jsonb NOT NULL,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_version integer NOT NULL,
  expires_at timestamp(3) NOT NULL,
  created_at timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE admin_push_deliveries (
  event_id text NOT NULL REFERENCES admin_notification_events(id) ON DELETE CASCADE,
  subscription_id text NOT NULL REFERENCES admin_push_subscriptions(id) ON DELETE CASCADE,
  state text NOT NULL DEFAULT 'pending',
  attempts integer NOT NULL DEFAULT 0,
  next_at timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(event_id,subscription_id)
);
CREATE INDEX admin_push_jobs ON admin_push_deliveries(state,next_at);
ALTER TABLE admin_notification_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_notification_reads ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_push_deliveries ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON admin_notification_events,admin_notification_reads,admin_notification_preferences,admin_push_subscriptions,admin_push_deliveries FROM PUBLIC;
DO $$ BEGIN
  IF EXISTS(SELECT FROM pg_roles WHERE rolname='anon') THEN
    REVOKE ALL ON admin_notification_events,admin_notification_reads,admin_notification_preferences,admin_push_subscriptions,admin_push_deliveries FROM anon;
  END IF;
  IF EXISTS(SELECT FROM pg_roles WHERE rolname='authenticated') THEN
    REVOKE ALL ON admin_notification_events,admin_notification_reads,admin_notification_preferences,admin_push_subscriptions,admin_push_deliveries FROM authenticated;
  END IF;
END $$;

CREATE FUNCTION admin_capture_review_notification() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  row_data jsonb; old_data jsonb; record_kind text; record_key text;
  brgy text; local_title text; item_status text; previous_status text; needs_review boolean;
BEGIN
  row_data := CASE WHEN TG_OP='DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END;
  old_data := CASE WHEN TG_OP='UPDATE' THEN to_jsonb(OLD) ELSE '{}'::jsonb END;
  record_key := row_data->>'id';
  CASE TG_TABLE_NAME
    WHEN 'id_verification_submissions' THEN
      record_kind := 'id_verification'; brgy := row_data->>'barangay';
      local_title := 'ID verification waiting for review';
      needs_review := row_data->>'status'='pending';
    WHEN 'ChallengeSubmission' THEN
      record_kind := 'challenge_submission';
      SELECT city INTO brgy FROM "Profile" WHERE "userId"=row_data->>'userId';
      local_title := 'Challenge proof waiting for review';
      needs_review := row_data->>'status' IN ('pending','final_review');
    WHEN 'event_submissions' THEN
      record_kind := 'event_submission';
      SELECT city INTO brgy FROM "Profile" WHERE "userId"=row_data->>'user_id';
      local_title := 'Event attendance waiting for review';
      needs_review := row_data->>'status'='pending';
    WHEN 'redeem_requests' THEN
      record_kind := 'redemption';
      SELECT city INTO brgy FROM "Profile" WHERE "userId"=row_data->>'user_id';
      local_title := 'Reward redemption waiting for review';
      needs_review := row_data->>'status'='pending';
    WHEN 'swap_listings' THEN
      record_kind := 'listing'; brgy := row_data->>'city';
      local_title := 'Swap listing waiting for review';
      needs_review := row_data->>'approval_status'='pending';
    WHEN 'swap_listing_reports' THEN
      record_kind := 'listing_report';
      SELECT city INTO brgy FROM swap_listings WHERE id=row_data->>'listing_id';
      local_title := 'Swap listing reported';
      needs_review := row_data->>'resolved_at' IS NULL;
  END CASE;
  item_status := CASE record_kind WHEN 'listing' THEN row_data->>'approval_status'
    WHEN 'listing_report' THEN CASE WHEN row_data->>'resolved_at' IS NULL THEN 'pending' ELSE 'resolved' END
    ELSE coalesce(row_data->>'status','pending') END;
  previous_status := CASE record_kind WHEN 'listing' THEN old_data->>'approval_status'
    WHEN 'listing_report' THEN CASE WHEN old_data->>'resolved_at' IS NULL THEN 'pending' ELSE 'resolved' END
    ELSE old_data->>'status' END;
  IF TG_OP='UPDATE' AND previous_status IS DISTINCT FROM item_status THEN
    UPDATE admin_notification_events SET resolved_at=CURRENT_TIMESTAMP
      WHERE record_type=record_kind AND record_id=record_key AND action_required AND resolved_at IS NULL;
  END IF;
  IF TG_OP='DELETE' OR NOT needs_review THEN
    UPDATE admin_notification_events SET resolved_at=CURRENT_TIMESTAMP
      WHERE record_type=record_kind AND record_id=record_key AND resolved_at IS NULL;
  ELSE
    IF TG_OP='INSERT' OR previous_status IS DISTINCT FROM item_status THEN
      INSERT INTO admin_notification_events(event_key,category,title,message,record_type,record_id,barangays,action_required)
      VALUES(record_kind || ':' || record_key || ':' || item_status || CASE WHEN TG_OP='UPDATE' THEN ':transition:' || md5(row_data::text || clock_timestamp()::text) ELSE '' END,
        CASE record_kind WHEN 'id_verification' THEN 'verification' WHEN 'challenge_submission' THEN 'challenge'
          WHEN 'event_submission' THEN 'event' WHEN 'redemption' THEN 'reward' ELSE 'swap' END,
        local_title,'Open the record to review its current status.',record_kind,record_key,
        CASE WHEN nullif(trim(brgy),'') IS NULL THEN '{}'::text[] ELSE ARRAY[trim(brgy)] END,true)
      ON CONFLICT(event_key) DO NOTHING;
    END IF;
  END IF;
  IF TG_OP='UPDATE' AND previous_status IS DISTINCT FROM item_status AND NOT needs_review THEN
    INSERT INTO admin_notification_events(event_key,category,title,message,record_type,record_id,barangays)
    VALUES(record_kind || ':' || record_key || ':status:' || item_status,
      CASE record_kind WHEN 'id_verification' THEN 'verification' WHEN 'challenge_submission' THEN 'challenge'
        WHEN 'event_submission' THEN 'event' WHEN 'redemption' THEN 'reward' ELSE 'swap' END,
      'Review status updated','Current status: ' || item_status,record_kind,record_key,
      CASE WHEN nullif(trim(brgy),'') IS NULL THEN '{}'::text[] ELSE ARRAY[trim(brgy)] END)
    ON CONFLICT(event_key) DO NOTHING;
  END IF;
  RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
END $$;
CREATE TRIGGER admin_id_review AFTER INSERT OR UPDATE OR DELETE ON id_verification_submissions FOR EACH ROW EXECUTE FUNCTION admin_capture_review_notification();
CREATE TRIGGER admin_challenge_review AFTER INSERT OR UPDATE OR DELETE ON "ChallengeSubmission" FOR EACH ROW EXECUTE FUNCTION admin_capture_review_notification();
CREATE TRIGGER admin_attendance_review AFTER INSERT OR UPDATE OR DELETE ON event_submissions FOR EACH ROW EXECUTE FUNCTION admin_capture_review_notification();
CREATE TRIGGER admin_redemption_review AFTER INSERT OR UPDATE OR DELETE ON redeem_requests FOR EACH ROW EXECUTE FUNCTION admin_capture_review_notification();
CREATE TRIGGER admin_listing_review AFTER INSERT OR UPDATE OR DELETE ON swap_listings FOR EACH ROW EXECUTE FUNCTION admin_capture_review_notification();
CREATE TRIGGER admin_listing_report AFTER INSERT OR UPDATE OR DELETE ON swap_listing_reports FOR EACH ROW EXECUTE FUNCTION admin_capture_review_notification();

CREATE FUNCTION admin_capture_content_notification() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE d jsonb; previous jsonb; kind text; visible boolean; was_visible boolean; audience_value text := 'both';
  areas text[] := '{}'; visible_at timestamp; event_key_value text; title_value text;
BEGIN
  d := CASE WHEN TG_OP='DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END;
  previous := CASE WHEN TG_OP='UPDATE' THEN to_jsonb(OLD) ELSE '{}'::jsonb END;
  IF TG_TABLE_NAME='lessons' THEN
    kind := 'lesson'; audience_value := 'admin'; visible := coalesce((d->>'is_published')::boolean,false);
    was_visible := coalesce((previous->>'is_published')::boolean,false);
  ELSIF TG_TABLE_NAME='announcements' THEN
    kind := 'announcement'; visible := d->>'status'='Published' OR d->>'status'='Scheduled';
    was_visible := previous->>'status' IN ('Published','Scheduled');
    IF d->>'targetAudience'<>'All Residents' THEN SELECT ARRAY(SELECT jsonb_array_elements_text(d->'barangays')) INTO areas; END IF;
    visible_at := CASE WHEN d->>'status'='Scheduled' THEN (d->>'publishAt')::timestamp ELSE CURRENT_TIMESTAMP END;
  ELSIF TG_TABLE_NAME='Challenge' THEN
    kind := 'challenge'; visible := coalesce((d->>'active')::boolean,false); was_visible := coalesce((previous->>'active')::boolean,false);
    visible_at := greatest(CURRENT_TIMESTAMP,(d->>'startDate')::timestamp);
  ELSE
    kind := 'event'; visible := coalesce((d->>'is_published')::boolean,false); was_visible := coalesce((previous->>'is_published')::boolean,false);
    IF nullif(d->>'barangay','') IS NOT NULL THEN areas := ARRAY[d->>'barangay']; END IF;
  END IF;
  IF TG_OP='DELETE' OR NOT visible THEN
    DELETE FROM admin_notification_events WHERE record_type=kind AND record_id=d->>'id' AND available_at>CURRENT_TIMESTAMP;
    UPDATE admin_notification_events SET resolved_at=CURRENT_TIMESTAMP WHERE record_type=kind AND record_id=d->>'id';
    IF TG_OP='DELETE' THEN RETURN OLD; END IF;
    IF kind='event' AND was_visible THEN
      INSERT INTO admin_notification_events(event_key,category,title,message,record_type,record_id,barangays,available_at)
      VALUES('event:withdrawn:' || (d->>'id') || ':' || md5(coalesce(d->>'updatedAt',clock_timestamp()::text)),
        'event','Event withdrawn',left(d->>'title',160),kind,d->>'id',areas,CURRENT_TIMESTAMP) ON CONFLICT DO NOTHING;
    END IF;
    RETURN NEW;
  END IF;
  event_key_value := kind || ':published:' || (d->>'id');
  title_value := CASE kind WHEN 'lesson' THEN 'Lesson published' WHEN 'challenge' THEN 'Challenge started'
    WHEN 'announcement' THEN 'Announcement published' ELSE 'Event published' END;
  INSERT INTO admin_notification_events(event_key,category,title,message,record_type,record_id,barangays,audience,available_at)
  VALUES(event_key_value,CASE kind WHEN 'lesson' THEN 'learning' ELSE kind END,title_value,left(d->>'title',160),kind,d->>'id',areas,audience_value,coalesce(visible_at,CURRENT_TIMESTAMP))
  ON CONFLICT(event_key) DO UPDATE SET barangays=EXCLUDED.barangays,available_at=CASE WHEN admin_notification_events.available_at>CURRENT_TIMESTAMP THEN EXCLUDED.available_at ELSE admin_notification_events.available_at END;
  IF kind='event' AND TG_OP='UPDATE' AND was_visible AND
    (previous->>'start_datetime' IS DISTINCT FROM d->>'start_datetime' OR previous->>'location' IS DISTINCT FROM d->>'location') THEN
    INSERT INTO admin_notification_events(event_key,category,title,message,record_type,record_id,barangays)
    VALUES('event:changed:' || (d->>'id') || ':' || md5(d::text),'event','Event schedule or location changed',left(d->>'title',160),kind,d->>'id',areas) ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER admin_lesson_content AFTER INSERT OR UPDATE OR DELETE ON lessons FOR EACH ROW EXECUTE FUNCTION admin_capture_content_notification();
CREATE TRIGGER admin_challenge_content AFTER INSERT OR UPDATE OR DELETE ON "Challenge" FOR EACH ROW EXECUTE FUNCTION admin_capture_content_notification();
CREATE TRIGGER admin_event_content AFTER INSERT OR UPDATE OR DELETE ON "Event" FOR EACH ROW EXECUTE FUNCTION admin_capture_content_notification();
CREATE TRIGGER admin_announcement_content AFTER INSERT OR UPDATE OR DELETE ON announcements FOR EACH ROW EXECUTE FUNCTION admin_capture_content_notification();

CREATE FUNCTION admin_capture_delivery_failure() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.state IN ('failed','uncertain') OR (NEW.state='pending' AND NEW.attempts>=3) THEN
    INSERT INTO admin_notification_events(event_key,category,title,message,record_type,record_id,audience,action_required)
    VALUES('delivery-failures:' || date_trunc('hour',CURRENT_TIMESTAMP)::text,'system','Notification deliveries need attention',
      'Some deliveries failed or have an uncertain result. Inspect delivery status before retrying.','delivery_failure',date_trunc('hour',CURRENT_TIMESTAMP)::text,'admin',true)
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER admin_delivery_failure AFTER UPDATE ON notification_deliveries FOR EACH ROW EXECUTE FUNCTION admin_capture_delivery_failure();
CREATE TRIGGER admin_browser_delivery_failure AFTER UPDATE ON admin_push_deliveries FOR EACH ROW EXECUTE FUNCTION admin_capture_delivery_failure();

-- Preserve current queues without sending historical browser alerts.
INSERT INTO admin_notification_events(event_key,category,title,message,record_type,record_id,barangays,action_required,available_at)
SELECT 'id_verification:' || id || ':pending','verification','ID verification waiting for review','Open the record to review its current status.','id_verification',id,ARRAY[barangay],true,submitted_at
FROM id_verification_submissions WHERE status='pending';
INSERT INTO admin_notification_events(event_key,category,title,message,record_type,record_id,barangays,action_required,available_at)
SELECT 'challenge_submission:' || s.id || ':' || s.status::text,'challenge','Challenge proof waiting for review','Open the record to review its current status.','challenge_submission',s.id,
  CASE WHEN nullif(trim(p.city),'') IS NULL THEN '{}'::text[] ELSE ARRAY[trim(p.city)] END,true,s.created_at
FROM "ChallengeSubmission" s LEFT JOIN "Profile" p ON p."userId"=s."userId" WHERE s.status::text IN ('pending','final_review');
INSERT INTO admin_notification_events(event_key,category,title,message,record_type,record_id,barangays,action_required,available_at)
SELECT 'event_submission:' || s.id || ':pending','event','Event attendance waiting for review','Open the record to review its current status.','event_submission',s.id,
  CASE WHEN nullif(trim(p.city),'') IS NULL THEN '{}'::text[] ELSE ARRAY[trim(p.city)] END,true,s.submitted_at
FROM event_submissions s LEFT JOIN "Profile" p ON p."userId"=s.user_id WHERE s.status='pending';
INSERT INTO admin_notification_events(event_key,category,title,message,record_type,record_id,barangays,action_required,available_at)
SELECT 'redemption:' || s.id || ':pending','reward','Reward redemption waiting for review','Open the record to review its current status.','redemption',s.id,
  CASE WHEN nullif(trim(p.city),'') IS NULL THEN '{}'::text[] ELSE ARRAY[trim(p.city)] END,true,s.created_at
FROM redeem_requests s LEFT JOIN "Profile" p ON p."userId"=s.user_id WHERE s.status='pending';
INSERT INTO admin_notification_events(event_key,category,title,message,record_type,record_id,barangays,action_required,available_at)
SELECT 'listing:' || id || ':pending','swap','Swap listing waiting for review','Open the record to review its current status.','listing',id,
  CASE WHEN nullif(trim(city),'') IS NULL THEN '{}'::text[] ELSE ARRAY[trim(city)] END,true,created_at FROM swap_listings WHERE approval_status='pending';
INSERT INTO admin_notification_events(event_key,category,title,message,record_type,record_id,barangays,action_required,available_at)
SELECT 'listing_report:' || r.id || ':pending','swap','Swap listing reported','Open the record to review its current status.','listing_report',r.id,
  CASE WHEN nullif(trim(l.city),'') IS NULL THEN '{}'::text[] ELSE ARRAY[trim(l.city)] END,true,r.created_at
FROM swap_listing_reports r JOIN swap_listings l ON l.id=r.listing_id WHERE r.resolved_at IS NULL;
INSERT INTO admin_notification_events(event_key,category,title,message,record_type,record_id,audience,available_at)
SELECT 'lesson:published:' || id,'learning','Lesson published',left(title,160),'lesson',id,'admin',created_at FROM lessons WHERE is_published;
INSERT INTO admin_notification_events(event_key,category,title,message,record_type,record_id,available_at)
SELECT 'challenge:published:' || id,'challenge','Challenge started',left(title,160),'challenge',id,greatest("createdAt",coalesce("startDate","createdAt"))
FROM "Challenge" WHERE active;
INSERT INTO admin_notification_events(event_key,category,title,message,record_type,record_id,barangays,available_at)
SELECT 'event:published:' || id,'event','Event published',left(title,160),'event',id,
  CASE WHEN nullif(barangay,'') IS NULL THEN '{}'::text[] ELSE ARRAY[barangay] END,"createdAt" FROM "Event" WHERE is_published;
INSERT INTO admin_notification_events(event_key,category,title,message,record_type,record_id,barangays,available_at)
SELECT 'announcement:published:' || id,'announcement','Announcement published',left(title,160),'announcement',id,
  CASE WHEN "targetAudience"='All Residents' THEN '{}'::text[] ELSE barangays END,
  CASE WHEN status='Scheduled' THEN coalesce("publishAt","createdAt") ELSE "createdAt" END FROM announcements WHERE status IN ('Published','Scheduled');
