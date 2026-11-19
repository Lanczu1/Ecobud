-- web_sessions: one row per web dashboard login, so logout and the idle limit end that token on the server.
-- login_attempts: failed sign-in counts per email, so a lockout survives an API restart.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

CREATE TABLE "web_sessions" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "user_id" TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "last_activity_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "revoked_at" TIMESTAMP(3)
);
CREATE INDEX "web_sessions_user_id_idx" ON "web_sessions"("user_id");
CREATE INDEX "web_sessions_expires_at_idx" ON "web_sessions"("expires_at");

CREATE TABLE "login_attempts" (
  "email" TEXT NOT NULL PRIMARY KEY,
  "count" INTEGER NOT NULL DEFAULT 0,
  "first_attempt_at" TIMESTAMP(3) NOT NULL,
  "locked_until" TIMESTAMP(3)
);
CREATE INDEX "login_attempts_first_attempt_at_idx" ON "login_attempts"("first_attempt_at");

ALTER TABLE "web_sessions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "login_attempts" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "web_sessions" FROM PUBLIC;
REVOKE ALL ON "login_attempts" FROM PUBLIC;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON "web_sessions" FROM anon;
    REVOKE ALL ON "login_attempts" FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON "web_sessions" FROM authenticated;
    REVOKE ALL ON "login_attempts" FROM authenticated;
  END IF;
  -- Same access as deploy/restrict-supabase-tables.sql gives the backend role on the other tables.
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ecobud_backend') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON "web_sessions", "login_attempts" TO ecobud_backend;
    CREATE POLICY ecobud_backend_access ON "web_sessions" TO ecobud_backend USING (true) WITH CHECK (true);
    CREATE POLICY ecobud_backend_access ON "login_attempts" TO ecobud_backend USING (true) WITH CHECK (true);
  END IF;
END $$;
COMMIT;
