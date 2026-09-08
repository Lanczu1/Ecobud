ALTER TABLE "users" ADD COLUMN "sessionVersion" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "users" ADD COLUMN "googleIdentityId" TEXT;
CREATE UNIQUE INDEX "users_googleIdentityId_key" ON "users"("googleIdentityId");
ALTER TABLE "OtpCode" ADD COLUMN "attempts" INTEGER NOT NULL DEFAULT 0;
