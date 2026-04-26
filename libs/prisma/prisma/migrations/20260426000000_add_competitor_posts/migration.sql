-- AlterTable: add new columns to Competitor
ALTER TABLE "Competitor" ADD COLUMN IF NOT EXISTS "avatar"     TEXT;
ALTER TABLE "Competitor" ADD COLUMN IF NOT EXISTS "following"  INTEGER;
ALTER TABLE "Competitor" ADD COLUMN IF NOT EXISTS "postsCount" INTEGER;
ALTER TABLE "Competitor" ADD COLUMN IF NOT EXISTS "bio"        TEXT;
ALTER TABLE "Competitor" ADD COLUMN IF NOT EXISTS "isActive"   BOOLEAN NOT NULL DEFAULT TRUE;

-- Unique constraint (userId, username, platform)
ALTER TABLE "Competitor" ADD CONSTRAINT "Competitor_userId_username_platform_key"
  UNIQUE ("userId", "username", "platform") ON CONFLICT DO NOTHING;

-- CreateTable: CompetitorPost
CREATE TABLE IF NOT EXISTS "CompetitorPost" (
  "id"           TEXT NOT NULL,
  "competitorId" TEXT NOT NULL,
  "postId"       TEXT NOT NULL,
  "caption"      TEXT,
  "mediaType"    TEXT NOT NULL DEFAULT 'IMAGE',
  "likes"        INTEGER NOT NULL DEFAULT 0,
  "comments"     INTEGER NOT NULL DEFAULT 0,
  "hashtags"     TEXT[] NOT NULL DEFAULT '{}',
  "publishedAt"  TIMESTAMP(3) NOT NULL,
  "thumbnail"    TEXT,
  "url"          TEXT,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CompetitorPost_pkey" PRIMARY KEY ("id")
);

-- Unique postId
CREATE UNIQUE INDEX IF NOT EXISTS "CompetitorPost_postId_key" ON "CompetitorPost"("postId");

-- Indexes
CREATE INDEX IF NOT EXISTS "CompetitorPost_competitorId_idx"             ON "CompetitorPost"("competitorId");
CREATE INDEX IF NOT EXISTS "CompetitorPost_competitorId_publishedAt_idx" ON "CompetitorPost"("competitorId", "publishedAt");

-- FK
ALTER TABLE "CompetitorPost" ADD CONSTRAINT "CompetitorPost_competitorId_fkey"
  FOREIGN KEY ("competitorId") REFERENCES "Competitor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
