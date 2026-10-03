CREATE TYPE "IdVerificationStatus" AS ENUM ('not_submitted', 'pending', 'approved', 'rejected');
ALTER TABLE "users" ADD COLUMN "id_verification_status" "IdVerificationStatus" NOT NULL DEFAULT 'not_submitted';
CREATE TABLE "id_verification_submissions" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "user_id" TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "legal_name" TEXT NOT NULL,
  "id_type" TEXT NOT NULL,
  "barangay" TEXT NOT NULL,
  "document_path" TEXT,
  "status" "IdVerificationStatus" NOT NULL DEFAULT 'pending',
  "reason" TEXT,
  "reviewer_id" TEXT REFERENCES "users"("id") ON DELETE SET NULL,
  "submitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewed_at" TIMESTAMP(3)
);
CREATE INDEX "id_verification_submissions_status_barangay_submitted_at_idx" ON "id_verification_submissions"("status", "barangay", "submitted_at");
CREATE INDEX "id_verification_submissions_user_id_submitted_at_idx" ON "id_verification_submissions"("user_id", "submitted_at");
CREATE UNIQUE INDEX "id_verification_one_pending_per_user" ON "id_verification_submissions"("user_id") WHERE "status" = 'pending';

CREATE INDEX "id_verification_submissions_reviewed_at_idx" ON "id_verification_submissions"("reviewed_at");

ALTER TABLE id_verification_submissions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON id_verification_submissions FROM PUBLIC;
DO $$
DECLARE client_role TEXT;
BEGIN
  FOREACH client_role IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = client_role) THEN
      EXECUTE format('REVOKE ALL ON id_verification_submissions FROM %I', client_role);
      IF to_regclass('storage.objects') IS NOT NULL THEN
        EXECUTE format('CREATE POLICY ecobud_private_ids_%s ON storage.objects AS RESTRICTIVE FOR ALL TO %I USING (bucket_id <> ''ecobud-private-ids'') WITH CHECK (bucket_id <> ''ecobud-private-ids'')', client_role, client_role);
      END IF;
    END IF;
  END LOOP;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ecobud_backend') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON id_verification_submissions TO ecobud_backend;
    CREATE POLICY ecobud_backend_ids ON id_verification_submissions
      FOR ALL TO ecobud_backend USING (true) WITH CHECK (true);
  END IF;
END $$;

CREATE FUNCTION prevent_client_id_approval() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF current_user IN ('anon', 'authenticated') THEN
    IF TG_OP = 'INSERT' THEN
      IF NEW.id_verification_status <> 'not_submitted' THEN
        RAISE EXCEPTION 'ID status is managed by the verification service';
      END IF;
    ELSIF NEW.id_verification_status IS DISTINCT FROM OLD.id_verification_status THEN
      RAISE EXCEPTION 'ID status is managed by the verification service';
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER users_protect_id_approval BEFORE INSERT OR UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION prevent_client_id_approval();
