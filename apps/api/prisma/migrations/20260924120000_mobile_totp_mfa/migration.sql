ALTER TABLE "users"
  ADD COLUMN "totp_secret_encrypted" TEXT,
  ADD COLUMN "totp_enabled_at" TIMESTAMP(3),
  ADD COLUMN "totp_last_used_step" BIGINT;

CREATE TABLE "mfa_login_challenges" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "client_type" TEXT NOT NULL,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "consumed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "mfa_login_challenges_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "mfa_recovery_codes" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "code_hash" TEXT NOT NULL,
  "used_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "mfa_recovery_codes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "mfa_enrollments" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "secret_encrypted" TEXT NOT NULL,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "mfa_enrollments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "mfa_login_challenges_expires_at_idx" ON "mfa_login_challenges"("expires_at");
CREATE INDEX "mfa_login_challenges_user_id_consumed_at_idx" ON "mfa_login_challenges"("user_id", "consumed_at");
CREATE INDEX "mfa_recovery_codes_user_id_used_at_idx" ON "mfa_recovery_codes"("user_id", "used_at");
CREATE INDEX "mfa_enrollments_user_id_expires_at_idx" ON "mfa_enrollments"("user_id", "expires_at");

ALTER TABLE "mfa_login_challenges" ADD CONSTRAINT "mfa_login_challenges_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "mfa_recovery_codes" ADD CONSTRAINT "mfa_recovery_codes_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "mfa_enrollments" ADD CONSTRAINT "mfa_enrollments_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
