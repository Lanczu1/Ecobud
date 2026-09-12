-- Additive-only, server-managed AI attempt limits shared across devices.
CREATE TABLE challenge_ai_attempt_limits (
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  challenge_id text NOT NULL REFERENCES "Challenge"(id) ON DELETE CASCADE,
  attempts_used integer NOT NULL DEFAULT 0,
  reset_at timestamp(3) NOT NULL,
  created_at timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT challenge_ai_attempt_limits_pkey PRIMARY KEY (user_id, challenge_id),
  CONSTRAINT challenge_ai_attempt_limits_attempts_check CHECK (attempts_used BETWEEN 0 AND 3)
);

CREATE INDEX challenge_ai_attempt_limits_challenge_idx
  ON challenge_ai_attempt_limits(challenge_id);
CREATE INDEX challenge_ai_attempt_limits_reset_idx
  ON challenge_ai_attempt_limits(reset_at);

ALTER TABLE challenge_ai_attempt_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON challenge_ai_attempt_limits FROM PUBLIC, anon, authenticated;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ecobud_backend') THEN
    GRANT SELECT, INSERT, UPDATE ON challenge_ai_attempt_limits TO ecobud_backend;
    CREATE POLICY ecobud_backend_challenge_ai_attempt_limits
      ON challenge_ai_attempt_limits
      FOR ALL TO ecobud_backend
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;
