ALTER TABLE "SoloRound" ADD COLUMN "scoreStatus" TEXT NOT NULL DEFAULT 'draft';
ALTER TABLE "SoloRound" ADD COLUMN "scoreError" TEXT NOT NULL DEFAULT '';
ALTER TABLE "SoloRound" ADD COLUMN "scoreEvidence" TEXT NOT NULL DEFAULT '[]';
ALTER TABLE "SoloRound" ADD COLUMN "scoreConfidence" TEXT;
