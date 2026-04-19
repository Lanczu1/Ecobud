-- AlterTable
ALTER TABLE "presence_sessions"
ALTER COLUMN "connected_at" TYPE TIMESTAMPTZ(3) USING "connected_at" AT TIME ZONE 'UTC',
ALTER COLUMN "last_seen_at" TYPE TIMESTAMPTZ(3) USING "last_seen_at" AT TIME ZONE 'UTC',
ALTER COLUMN "updated_at" TYPE TIMESTAMPTZ(3) USING "updated_at" AT TIME ZONE 'UTC',
ALTER COLUMN "disconnected_at" TYPE TIMESTAMPTZ(3) USING CASE
  WHEN "disconnected_at" IS NULL THEN NULL
  ELSE "disconnected_at" AT TIME ZONE 'UTC'
END,
ALTER COLUMN "expires_at" TYPE TIMESTAMPTZ(3) USING "expires_at" AT TIME ZONE 'UTC';
