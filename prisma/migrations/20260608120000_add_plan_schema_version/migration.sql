ALTER TABLE "Plan" ADD COLUMN "schemaVersion" INTEGER NOT NULL DEFAULT 1;

UPDATE "Plan"
SET "schemaVersion" = 3
WHERE workout->>'schemaVersion' = '3'
  AND diet->>'schemaVersion' = '3';

ALTER TABLE "Plan" ALTER COLUMN "schemaVersion" SET DEFAULT 3;

CREATE INDEX "Plan_userId_schemaVersion_createdAt_idx" ON "Plan"("userId", "schemaVersion", "createdAt");
