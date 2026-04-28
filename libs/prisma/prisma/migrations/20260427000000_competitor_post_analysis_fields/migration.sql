-- Add analysis + scraping columns to CompetitorPost
ALTER TABLE "CompetitorPost" ADD COLUMN IF NOT EXISTS "isReel"         BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE "CompetitorPost" ADD COLUMN IF NOT EXISTS "views"          INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "CompetitorPost" ADD COLUMN IF NOT EXISTS "transcript"     TEXT;
ALTER TABLE "CompetitorPost" ADD COLUMN IF NOT EXISTS "hookText"       TEXT;
ALTER TABLE "CompetitorPost" ADD COLUMN IF NOT EXISTS "hookType"       TEXT;
ALTER TABLE "CompetitorPost" ADD COLUMN IF NOT EXISTS "whyItWorks"     TEXT;
ALTER TABLE "CompetitorPost" ADD COLUMN IF NOT EXISTS "emotionTrigger" TEXT;
ALTER TABLE "CompetitorPost" ADD COLUMN IF NOT EXISTS "keyTakeaway"    TEXT;
ALTER TABLE "CompetitorPost" ADD COLUMN IF NOT EXISTS "analysisScore"  INTEGER;
ALTER TABLE "CompetitorPost" ADD COLUMN IF NOT EXISTS "analyzedAt"     TIMESTAMP(3);

-- Earlier migration set publishedAt NOT NULL; relax for posts whose date we don't know yet.
ALTER TABLE "CompetitorPost" ALTER COLUMN "publishedAt" DROP NOT NULL;
