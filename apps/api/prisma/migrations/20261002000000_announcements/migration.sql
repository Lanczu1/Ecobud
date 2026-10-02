CREATE TABLE "announcements" (
 "id" TEXT PRIMARY KEY, "title" TEXT NOT NULL, "content" TEXT NOT NULL,
 "category" TEXT NOT NULL, "image" TEXT, "status" TEXT NOT NULL DEFAULT 'Draft',
 "priority" TEXT NOT NULL DEFAULT 'Normal', "targetAudience" TEXT NOT NULL DEFAULT 'All Residents',
 "barangays" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[], "publishAt" TIMESTAMP(3), "expiresAt" TIMESTAMP(3),
 "ctaLabel" TEXT, "ctaType" TEXT NOT NULL DEFAULT 'No Action', "ctaValue" TEXT,
 "createdById" TEXT NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE INDEX "announcements_status_publishAt_expiresAt_idx" ON "announcements"("status", "publishAt", "expiresAt");
ALTER TABLE "announcements" ENABLE ROW LEVEL SECURITY;
