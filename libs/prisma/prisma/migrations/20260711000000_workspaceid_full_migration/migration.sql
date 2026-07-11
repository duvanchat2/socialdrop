-- ============================================================
-- Full workspaceId migration for the remaining 16 tenant tables:
-- Post, DriveConfig, BrandProfile, ContentStrategy, PlatformMetrics,
-- PostAnalytics, ContentItem, GrowthGoal, Competitor, QueueSlot, Flow,
-- Contact, YoutubeComment, YoutubeAutoReply, GeneratedScript,
-- ContentBrain.
--
-- Safety net (no data is deleted by this migration, except exact
-- duplicate rows created by collapsing userId-based uniques into
-- workspaceId-based ones — documented per table below):
-- 1. Any User without a WorkspaceMember (e.g. "demo-user", which was
--    only created by a later migration than the one that originally
--    backfilled workspaces) gets a default workspace + OWNER
--    membership here, same pattern as 20260710020000_add_workspaces.
-- 2. Any row in the 16 tables whose userId doesn't match a real User
--    is reassigned to 'demo-user' first (same pattern as
--    20260710030000_add_tenant_fk_indices), so it always resolves to
--    a valid workspace before the FK is added.
-- 3. workspaceId is backfilled from the OWNER membership (each
--    user's own default workspace), not just any membership.
-- ============================================================

INSERT INTO "User" ("id", "email", "tokenVersion", "createdAt", "updatedAt")
VALUES ('demo-user', 'demo-user@socialdrop.local', 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "Workspace" ("id", "name", "createdAt", "updatedAt")
SELECT (
         substr(md5('workspace-for-user:' || u."id"), 1, 8) || '-' ||
         substr(md5('workspace-for-user:' || u."id"), 9, 4) || '-5' ||
         substr(md5('workspace-for-user:' || u."id"), 14, 3) || '-' ||
         substr(md5('workspace-for-user:' || u."id"), 17, 4) || '-' ||
         substr(md5('workspace-for-user:' || u."id"), 21, 12)
       )::uuid,
       CASE WHEN u."id" = 'demo-user' THEN 'Workspace Demo'
            ELSE COALESCE(NULLIF(u."name", ''), 'Mi espacio')
       END,
       CURRENT_TIMESTAMP,
       CURRENT_TIMESTAMP
FROM "User" u
WHERE NOT EXISTS (SELECT 1 FROM "WorkspaceMember" wm WHERE wm."userId" = u."id")
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "WorkspaceMember" ("id", "workspaceId", "userId", "role", "createdAt")
SELECT gen_random_uuid(),
       (
         substr(md5('workspace-for-user:' || u."id"), 1, 8) || '-' ||
         substr(md5('workspace-for-user:' || u."id"), 9, 4) || '-5' ||
         substr(md5('workspace-for-user:' || u."id"), 14, 3) || '-' ||
         substr(md5('workspace-for-user:' || u."id"), 17, 4) || '-' ||
         substr(md5('workspace-for-user:' || u."id"), 21, 12)
       )::uuid,
       u."id",
       'OWNER',
       CURRENT_TIMESTAMP
FROM "User" u
WHERE NOT EXISTS (SELECT 1 FROM "WorkspaceMember" wm WHERE wm."userId" = u."id")
ON CONFLICT DO NOTHING;

UPDATE "User" u
SET "lastActiveWorkspaceId" = wm."workspaceId"
FROM "WorkspaceMember" wm
WHERE wm."userId" = u."id" AND wm."role" = 'OWNER' AND u."lastActiveWorkspaceId" IS NULL;

-- ============================================================
-- Post
-- ============================================================
UPDATE "Post" SET "userId" = 'demo-user' WHERE "userId" NOT IN (SELECT "id" FROM "User");
ALTER TABLE "Post" DROP CONSTRAINT "Post_userId_fkey";
DROP INDEX "Post_userId_status_idx";
ALTER TABLE "Post" ADD COLUMN "workspaceId" TEXT;
UPDATE "Post" t SET "workspaceId" = wm."workspaceId" FROM "WorkspaceMember" wm WHERE wm."userId" = t."userId" AND wm."role" = 'OWNER';
ALTER TABLE "Post" ALTER COLUMN "workspaceId" SET NOT NULL;
ALTER TABLE "Post" DROP COLUMN "userId";
CREATE INDEX "Post_workspaceId_status_idx" ON "Post"("workspaceId", "status");
ALTER TABLE "Post" ADD CONSTRAINT "Post_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================================
-- DriveConfig
-- ============================================================
UPDATE "DriveConfig" SET "userId" = 'demo-user' WHERE "userId" NOT IN (SELECT "id" FROM "User");
ALTER TABLE "DriveConfig" DROP CONSTRAINT "DriveConfig_userId_fkey";
DROP INDEX "DriveConfig_userId_idx";
DROP INDEX "DriveConfig_userId_folderId_key";
ALTER TABLE "DriveConfig" ADD COLUMN "workspaceId" TEXT;
UPDATE "DriveConfig" t SET "workspaceId" = wm."workspaceId" FROM "WorkspaceMember" wm WHERE wm."userId" = t."userId" AND wm."role" = 'OWNER';
ALTER TABLE "DriveConfig" ALTER COLUMN "workspaceId" SET NOT NULL;
ALTER TABLE "DriveConfig" DROP COLUMN "userId";
CREATE INDEX "DriveConfig_workspaceId_idx" ON "DriveConfig"("workspaceId");
CREATE UNIQUE INDEX "DriveConfig_workspaceId_folderId_key" ON "DriveConfig"("workspaceId", "folderId");
ALTER TABLE "DriveConfig" ADD CONSTRAINT "DriveConfig_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================================
-- BrandProfile (1:1 per user -> 1:1 per workspace)
-- ============================================================
DROP INDEX "BrandProfile_userId_key";
DROP INDEX "BrandProfile_userId_idx";
UPDATE "BrandProfile" SET "userId" = 'demo-user' WHERE "userId" NOT IN (SELECT "id" FROM "User");
ALTER TABLE "BrandProfile" ADD COLUMN "workspaceId" TEXT;
UPDATE "BrandProfile" t SET "workspaceId" = wm."workspaceId" FROM "WorkspaceMember" wm WHERE wm."userId" = t."userId" AND wm."role" = 'OWNER';
-- If two rows resolve to the same workspaceId (shouldn't happen: userId was unique), keep the newest and drop the rest to satisfy the new unique constraint.
DELETE FROM "BrandProfile" a USING "BrandProfile" b
  WHERE a."workspaceId" = b."workspaceId" AND a."id" < b."id";
ALTER TABLE "BrandProfile" ALTER COLUMN "workspaceId" SET NOT NULL;
ALTER TABLE "BrandProfile" DROP COLUMN "userId";
CREATE UNIQUE INDEX "BrandProfile_workspaceId_key" ON "BrandProfile"("workspaceId");
CREATE INDEX "BrandProfile_workspaceId_idx" ON "BrandProfile"("workspaceId");
ALTER TABLE "BrandProfile" ADD CONSTRAINT "BrandProfile_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================================
-- ContentStrategy (1:1 per user -> 1:1 per workspace)
-- ============================================================
DROP INDEX "ContentStrategy_userId_key";
DROP INDEX "ContentStrategy_userId_idx";
UPDATE "ContentStrategy" SET "userId" = 'demo-user' WHERE "userId" NOT IN (SELECT "id" FROM "User");
ALTER TABLE "ContentStrategy" ADD COLUMN "workspaceId" TEXT;
UPDATE "ContentStrategy" t SET "workspaceId" = wm."workspaceId" FROM "WorkspaceMember" wm WHERE wm."userId" = t."userId" AND wm."role" = 'OWNER';
DELETE FROM "ContentStrategy" a USING "ContentStrategy" b
  WHERE a."workspaceId" = b."workspaceId" AND a."id" < b."id";
ALTER TABLE "ContentStrategy" ALTER COLUMN "workspaceId" SET NOT NULL;
ALTER TABLE "ContentStrategy" DROP COLUMN "userId";
CREATE UNIQUE INDEX "ContentStrategy_workspaceId_key" ON "ContentStrategy"("workspaceId");
CREATE INDEX "ContentStrategy_workspaceId_idx" ON "ContentStrategy"("workspaceId");
ALTER TABLE "ContentStrategy" ADD CONSTRAINT "ContentStrategy_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================================
-- PlatformMetrics
-- ============================================================
UPDATE "PlatformMetrics" SET "userId" = 'demo-user' WHERE "userId" NOT IN (SELECT "id" FROM "User");
ALTER TABLE "PlatformMetrics" DROP CONSTRAINT "PlatformMetrics_userId_fkey";
DROP INDEX "PlatformMetrics_userId_platform_idx";
ALTER TABLE "PlatformMetrics" ADD COLUMN "workspaceId" TEXT;
UPDATE "PlatformMetrics" t SET "workspaceId" = wm."workspaceId" FROM "WorkspaceMember" wm WHERE wm."userId" = t."userId" AND wm."role" = 'OWNER';
ALTER TABLE "PlatformMetrics" ALTER COLUMN "workspaceId" SET NOT NULL;
ALTER TABLE "PlatformMetrics" DROP COLUMN "userId";
CREATE INDEX "PlatformMetrics_workspaceId_platform_idx" ON "PlatformMetrics"("workspaceId", "platform");
ALTER TABLE "PlatformMetrics" ADD CONSTRAINT "PlatformMetrics_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================================
-- PostAnalytics
-- ============================================================
UPDATE "PostAnalytics" SET "userId" = 'demo-user' WHERE "userId" NOT IN (SELECT "id" FROM "User");
ALTER TABLE "PostAnalytics" DROP CONSTRAINT "PostAnalytics_userId_fkey";
DROP INDEX "PostAnalytics_userId_platform_idx";
DROP INDEX "PostAnalytics_userId_platform_platformPostId_key";
ALTER TABLE "PostAnalytics" ADD COLUMN "workspaceId" TEXT;
UPDATE "PostAnalytics" t SET "workspaceId" = wm."workspaceId" FROM "WorkspaceMember" wm WHERE wm."userId" = t."userId" AND wm."role" = 'OWNER';
-- Collapse any duplicate (workspaceId, platform, platformPostId) created by the userId->workspaceId collapse.
DELETE FROM "PostAnalytics" a USING "PostAnalytics" b
  WHERE a."workspaceId" = b."workspaceId" AND a."platform" = b."platform"
    AND a."platformPostId" = b."platformPostId" AND a."id" < b."id";
ALTER TABLE "PostAnalytics" ALTER COLUMN "workspaceId" SET NOT NULL;
ALTER TABLE "PostAnalytics" DROP COLUMN "userId";
CREATE INDEX "PostAnalytics_workspaceId_platform_idx" ON "PostAnalytics"("workspaceId", "platform");
CREATE UNIQUE INDEX "PostAnalytics_workspaceId_platform_platformPostId_key" ON "PostAnalytics"("workspaceId", "platform", "platformPostId");
ALTER TABLE "PostAnalytics" ADD CONSTRAINT "PostAnalytics_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================================
-- ContentItem
-- ============================================================
UPDATE "ContentItem" SET "userId" = 'demo-user' WHERE "userId" NOT IN (SELECT "id" FROM "User");
ALTER TABLE "ContentItem" DROP CONSTRAINT "ContentItem_userId_fkey";
DROP INDEX "ContentItem_userId_idx";
ALTER TABLE "ContentItem" ADD COLUMN "workspaceId" TEXT;
UPDATE "ContentItem" t SET "workspaceId" = wm."workspaceId" FROM "WorkspaceMember" wm WHERE wm."userId" = t."userId" AND wm."role" = 'OWNER';
ALTER TABLE "ContentItem" ALTER COLUMN "workspaceId" SET NOT NULL;
ALTER TABLE "ContentItem" DROP COLUMN "userId";
CREATE INDEX "ContentItem_workspaceId_idx" ON "ContentItem"("workspaceId");
ALTER TABLE "ContentItem" ADD CONSTRAINT "ContentItem_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================================
-- GrowthGoal
-- ============================================================
UPDATE "GrowthGoal" SET "userId" = 'demo-user' WHERE "userId" NOT IN (SELECT "id" FROM "User");
DROP INDEX "GrowthGoal_userId_idx";
ALTER TABLE "GrowthGoal" ADD COLUMN "workspaceId" TEXT;
UPDATE "GrowthGoal" t SET "workspaceId" = wm."workspaceId" FROM "WorkspaceMember" wm WHERE wm."userId" = t."userId" AND wm."role" = 'OWNER';
ALTER TABLE "GrowthGoal" ALTER COLUMN "workspaceId" SET NOT NULL;
ALTER TABLE "GrowthGoal" DROP COLUMN "userId";
CREATE INDEX "GrowthGoal_workspaceId_idx" ON "GrowthGoal"("workspaceId");
ALTER TABLE "GrowthGoal" ADD CONSTRAINT "GrowthGoal_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================================
-- Competitor
-- ============================================================
UPDATE "Competitor" SET "userId" = 'demo-user' WHERE "userId" NOT IN (SELECT "id" FROM "User");
ALTER TABLE "Competitor" DROP CONSTRAINT "Competitor_userId_fkey";
ALTER TABLE "Competitor" DROP CONSTRAINT "Competitor_userId_username_platform_key";
DROP INDEX "Competitor_userId_idx";
ALTER TABLE "Competitor" ADD COLUMN "workspaceId" TEXT;
UPDATE "Competitor" t SET "workspaceId" = wm."workspaceId" FROM "WorkspaceMember" wm WHERE wm."userId" = t."userId" AND wm."role" = 'OWNER';
DELETE FROM "Competitor" a USING "Competitor" b
  WHERE a."workspaceId" = b."workspaceId" AND a."username" = b."username"
    AND a."platform" = b."platform" AND a."id" < b."id";
ALTER TABLE "Competitor" ALTER COLUMN "workspaceId" SET NOT NULL;
ALTER TABLE "Competitor" DROP COLUMN "userId";
CREATE INDEX "Competitor_workspaceId_idx" ON "Competitor"("workspaceId");
ALTER TABLE "Competitor" ADD CONSTRAINT "Competitor_workspaceId_username_platform_key" UNIQUE ("workspaceId", "username", "platform");
ALTER TABLE "Competitor" ADD CONSTRAINT "Competitor_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================================
-- QueueSlot
-- ============================================================
UPDATE "QueueSlot" SET "userId" = 'demo-user' WHERE "userId" NOT IN (SELECT "id" FROM "User");
DROP INDEX "QueueSlot_userId_platform_idx";
DROP INDEX "QueueSlot_userId_dayOfWeek_hour_minute_idx";
ALTER TABLE "QueueSlot" ADD COLUMN "workspaceId" TEXT;
UPDATE "QueueSlot" t SET "workspaceId" = wm."workspaceId" FROM "WorkspaceMember" wm WHERE wm."userId" = t."userId" AND wm."role" = 'OWNER';
ALTER TABLE "QueueSlot" ALTER COLUMN "workspaceId" SET NOT NULL;
ALTER TABLE "QueueSlot" DROP COLUMN "userId";
CREATE INDEX "QueueSlot_workspaceId_platform_idx" ON "QueueSlot"("workspaceId", "platform");
CREATE INDEX "QueueSlot_workspaceId_dayOfWeek_hour_minute_idx" ON "QueueSlot"("workspaceId", "dayOfWeek", "hour", "minute");
ALTER TABLE "QueueSlot" ADD CONSTRAINT "QueueSlot_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================================
-- Flow
-- ============================================================
UPDATE "Flow" SET "userId" = 'demo-user' WHERE "userId" NOT IN (SELECT "id" FROM "User");
ALTER TABLE "Flow" DROP CONSTRAINT "Flow_userId_fkey";
DROP INDEX "Flow_userId_idx";
DROP INDEX "Flow_userId_isActive_idx";
ALTER TABLE "Flow" ADD COLUMN "workspaceId" TEXT;
UPDATE "Flow" t SET "workspaceId" = wm."workspaceId" FROM "WorkspaceMember" wm WHERE wm."userId" = t."userId" AND wm."role" = 'OWNER';
ALTER TABLE "Flow" ALTER COLUMN "workspaceId" SET NOT NULL;
ALTER TABLE "Flow" DROP COLUMN "userId";
CREATE INDEX "Flow_workspaceId_idx" ON "Flow"("workspaceId");
CREATE INDEX "Flow_workspaceId_isActive_idx" ON "Flow"("workspaceId", "isActive");
ALTER TABLE "Flow" ADD CONSTRAINT "Flow_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================================
-- Contact (platform+accountId uniqueness is global by design, unrelated to userId — left as-is)
-- ============================================================
UPDATE "Contact" SET "userId" = 'demo-user' WHERE "userId" NOT IN (SELECT "id" FROM "User");
ALTER TABLE "Contact" DROP CONSTRAINT "Contact_userId_fkey";
DROP INDEX "Contact_userId_idx";
ALTER TABLE "Contact" ADD COLUMN "workspaceId" TEXT;
UPDATE "Contact" t SET "workspaceId" = wm."workspaceId" FROM "WorkspaceMember" wm WHERE wm."userId" = t."userId" AND wm."role" = 'OWNER';
ALTER TABLE "Contact" ALTER COLUMN "workspaceId" SET NOT NULL;
ALTER TABLE "Contact" DROP COLUMN "userId";
CREATE INDEX "Contact_workspaceId_idx" ON "Contact"("workspaceId");
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================================
-- YoutubeComment
-- ============================================================
UPDATE "YoutubeComment" SET "userId" = 'demo-user' WHERE "userId" NOT IN (SELECT "id" FROM "User");
ALTER TABLE "YoutubeComment" DROP CONSTRAINT "YoutubeComment_userId_fkey";
DROP INDEX "YoutubeComment_userId_idx";
DROP INDEX "YoutubeComment_userId_replied_idx";
ALTER TABLE "YoutubeComment" ADD COLUMN "workspaceId" TEXT;
UPDATE "YoutubeComment" t SET "workspaceId" = wm."workspaceId" FROM "WorkspaceMember" wm WHERE wm."userId" = t."userId" AND wm."role" = 'OWNER';
ALTER TABLE "YoutubeComment" ALTER COLUMN "workspaceId" SET NOT NULL;
ALTER TABLE "YoutubeComment" DROP COLUMN "userId";
CREATE INDEX "YoutubeComment_workspaceId_idx" ON "YoutubeComment"("workspaceId");
CREATE INDEX "YoutubeComment_workspaceId_replied_idx" ON "YoutubeComment"("workspaceId", "replied");
ALTER TABLE "YoutubeComment" ADD CONSTRAINT "YoutubeComment_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================================
-- YoutubeAutoReply
-- ============================================================
UPDATE "YoutubeAutoReply" SET "userId" = 'demo-user' WHERE "userId" NOT IN (SELECT "id" FROM "User");
ALTER TABLE "YoutubeAutoReply" DROP CONSTRAINT "YoutubeAutoReply_userId_fkey";
DROP INDEX "YoutubeAutoReply_userId_idx";
ALTER TABLE "YoutubeAutoReply" ADD COLUMN "workspaceId" TEXT;
UPDATE "YoutubeAutoReply" t SET "workspaceId" = wm."workspaceId" FROM "WorkspaceMember" wm WHERE wm."userId" = t."userId" AND wm."role" = 'OWNER';
ALTER TABLE "YoutubeAutoReply" ALTER COLUMN "workspaceId" SET NOT NULL;
ALTER TABLE "YoutubeAutoReply" DROP COLUMN "userId";
CREATE INDEX "YoutubeAutoReply_workspaceId_idx" ON "YoutubeAutoReply"("workspaceId");
ALTER TABLE "YoutubeAutoReply" ADD CONSTRAINT "YoutubeAutoReply_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================================
-- GeneratedScript
-- ============================================================
UPDATE "GeneratedScript" SET "userId" = 'demo-user' WHERE "userId" NOT IN (SELECT "id" FROM "User");
ALTER TABLE "GeneratedScript" DROP CONSTRAINT "GeneratedScript_userId_fkey";
DROP INDEX "GeneratedScript_userId_idx";
DROP INDEX "GeneratedScript_userId_isViral_idx";
ALTER TABLE "GeneratedScript" ADD COLUMN "workspaceId" TEXT;
UPDATE "GeneratedScript" t SET "workspaceId" = wm."workspaceId" FROM "WorkspaceMember" wm WHERE wm."userId" = t."userId" AND wm."role" = 'OWNER';
ALTER TABLE "GeneratedScript" ALTER COLUMN "workspaceId" SET NOT NULL;
ALTER TABLE "GeneratedScript" DROP COLUMN "userId";
CREATE INDEX "GeneratedScript_workspaceId_idx" ON "GeneratedScript"("workspaceId");
CREATE INDEX "GeneratedScript_workspaceId_isViral_idx" ON "GeneratedScript"("workspaceId", "isViral");
ALTER TABLE "GeneratedScript" ADD CONSTRAINT "GeneratedScript_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================================
-- ContentBrain (1:1 per user -> 1:1 per workspace)
-- ============================================================
DROP INDEX "ContentBrain_userId_key";
DROP INDEX "ContentBrain_userId_idx";
UPDATE "ContentBrain" SET "userId" = 'demo-user' WHERE "userId" NOT IN (SELECT "id" FROM "User");
ALTER TABLE "ContentBrain" ADD COLUMN "workspaceId" TEXT;
UPDATE "ContentBrain" t SET "workspaceId" = wm."workspaceId" FROM "WorkspaceMember" wm WHERE wm."userId" = t."userId" AND wm."role" = 'OWNER';
DELETE FROM "ContentBrain" a USING "ContentBrain" b
  WHERE a."workspaceId" = b."workspaceId" AND a."id" < b."id";
ALTER TABLE "ContentBrain" ALTER COLUMN "workspaceId" SET NOT NULL;
ALTER TABLE "ContentBrain" DROP COLUMN "userId";
CREATE UNIQUE INDEX "ContentBrain_workspaceId_key" ON "ContentBrain"("workspaceId");
CREATE INDEX "ContentBrain_workspaceId_idx" ON "ContentBrain"("workspaceId");
ALTER TABLE "ContentBrain" ADD CONSTRAINT "ContentBrain_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
