-- ============================================================
-- Ensure a "demo-user" User row exists, so any orphaned userId
-- values in the tables below (rows whose userId doesn't match any
-- real User — e.g. old @default("demo-user") data written before
-- real auth existed) have somewhere valid to point before we add
-- FK constraints. No rows are deleted.
-- ============================================================
INSERT INTO "User" ("id", "email", "tokenVersion", "createdAt", "updatedAt")
VALUES ('demo-user', 'demo-user@socialdrop.local', 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;

-- Reassign any orphaned userId to demo-user (safety net; should be a no-op
-- if every existing userId already has a matching User row).
UPDATE "ContentItem" SET "userId" = 'demo-user' WHERE "userId" NOT IN (SELECT "id" FROM "User");
UPDATE "Flow" SET "userId" = 'demo-user' WHERE "userId" NOT IN (SELECT "id" FROM "User");
UPDATE "Contact" SET "userId" = 'demo-user' WHERE "userId" NOT IN (SELECT "id" FROM "User");
UPDATE "YoutubeComment" SET "userId" = 'demo-user' WHERE "userId" NOT IN (SELECT "id" FROM "User");
UPDATE "YoutubeAutoReply" SET "userId" = 'demo-user' WHERE "userId" NOT IN (SELECT "id" FROM "User");
UPDATE "Competitor" SET "userId" = 'demo-user' WHERE "userId" NOT IN (SELECT "id" FROM "User");
UPDATE "GeneratedScript" SET "userId" = 'demo-user' WHERE "userId" NOT IN (SELECT "id" FROM "User");
UPDATE "PlatformMetrics" SET "userId" = 'demo-user' WHERE "userId" NOT IN (SELECT "id" FROM "User");
UPDATE "PostAnalytics" SET "userId" = 'demo-user' WHERE "userId" NOT IN (SELECT "id" FROM "User");

-- Drop the now-removed @default("demo-user") on the schema side.
ALTER TABLE "ContentItem" ALTER COLUMN "userId" DROP DEFAULT;
ALTER TABLE "Flow" ALTER COLUMN "userId" DROP DEFAULT;
ALTER TABLE "Contact" ALTER COLUMN "userId" DROP DEFAULT;
ALTER TABLE "YoutubeComment" ALTER COLUMN "userId" DROP DEFAULT;
ALTER TABLE "YoutubeAutoReply" ALTER COLUMN "userId" DROP DEFAULT;

-- CreateIndex (ContentItem had no userId index before)
CREATE INDEX "ContentItem_userId_idx" ON "ContentItem"("userId");

-- AddForeignKey (cascade delete — deleting a User removes their tenant data)
ALTER TABLE "ContentItem" ADD CONSTRAINT "ContentItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Flow" ADD CONSTRAINT "Flow_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "YoutubeComment" ADD CONSTRAINT "YoutubeComment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "YoutubeAutoReply" ADD CONSTRAINT "YoutubeAutoReply_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Competitor" ADD CONSTRAINT "Competitor_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GeneratedScript" ADD CONSTRAINT "GeneratedScript_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PlatformMetrics" ADD CONSTRAINT "PlatformMetrics_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PostAnalytics" ADD CONSTRAINT "PostAnalytics_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
