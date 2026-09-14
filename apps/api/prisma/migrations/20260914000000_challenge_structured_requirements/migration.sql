ALTER TABLE "Challenge"
ADD COLUMN "requirement_type" TEXT NOT NULL DEFAULT 'quantity',
ADD COLUMN "requirement_target" TEXT NOT NULL DEFAULT '1',
ADD COLUMN "requirement_unit" TEXT NOT NULL DEFAULT 'piece',
ADD COLUMN "additional_instructions" TEXT;
