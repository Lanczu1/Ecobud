-- Review against the intended ECOBUD database and take a backup before applying.
-- Backend uses Prisma; clients use Auth and Broadcast, not these REST tables.
-- A dedicated LOGIN role must be created securely and granted ecobud_backend.
-- Do not put its password in this file. Point DATABASE_URL at that LOGIN role;
-- keep migration-owner credentials in DIRECT_URL only during deployments.
BEGIN;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ecobud_backend') THEN
    CREATE ROLE ecobud_backend NOLOGIN NOSUPERUSER NOBYPASSRLS;
  END IF;
END $$;
GRANT USAGE ON SCHEMA public TO ecobud_backend;
DO $$
DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'Badge','Challenge','ChallengeInstance','ChallengeSubmission','Event',
    'EventRegistration','Faq','Habit','HabitCheckIn','OtpCode','Profile',
    'SystemSetting','TransparencyLog','UserBadge','UserChallenge','audit_logs',
    'event_qr_codes','event_submissions','give_and_get_items','lesson_pages',
    'lesson_progress','lessons','notifications','presence_sessions','quiz_questions',
    'redeem_items','redeem_requests','reward_transactions','swap_conversations',
    'swap_listings','swap_messages','swap_requests','user_stats','user_weekly_goal','users'
  ] LOOP
    IF to_regclass(format('public.%I', table_name)) IS NOT NULL THEN
      EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC, anon, authenticated', table_name);
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
      EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.%I TO ecobud_backend', table_name);
      EXECUTE format('DROP POLICY IF EXISTS ecobud_backend_access ON public.%I', table_name);
      EXECUTE format('CREATE POLICY ecobud_backend_access ON public.%I TO ecobud_backend USING (true) WITH CHECK (true)', table_name);
    END IF;
  END LOOP;
END $$;
COMMIT;
