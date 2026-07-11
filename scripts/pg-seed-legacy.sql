-- Synthetic "legacy" data to rigorously test the workspaceId backfill migration.
--
-- Note: PR-14 already added FK(userId -> User.id) to 11 of the 16 tables
-- (Post, DriveConfig, ContentItem, PlatformMetrics, PostAnalytics, Competitor,
-- Flow, Contact, YoutubeComment, YoutubeAutoReply, GeneratedScript), so a
-- genuinely orphaned userId (not matching any User) is now structurally
-- impossible in those tables — confirmed empirically: inserting one violates
-- the FK. Only BrandProfile, ContentStrategy, GrowthGoal, QueueSlot and
-- ContentBrain still lack that FK, so that's where a real orphan-userId
-- scenario can be tested here.

-- Real second user + her own workspace (simulating the PR-31/32 register flow)
INSERT INTO "User" ("id", "email", "tokenVersion", "createdAt", "updatedAt")
VALUES ('user-jane', 'jane@example.com', 0, now(), now());

INSERT INTO "Workspace" ("id", "name", "createdAt", "updatedAt")
VALUES ('ws-jane', 'Jane Workspace', now(), now());

INSERT INTO "WorkspaceMember" ("id", "workspaceId", "userId", "role", "createdAt")
VALUES ('wm-jane', 'ws-jane', 'user-jane', 'OWNER', now());

UPDATE "User" SET "lastActiveWorkspaceId" = 'ws-jane' WHERE "id" = 'user-jane';

-- A THIRD real user who has a User row but NO WorkspaceMember at all (edge case:
-- account created outside the normal register flow) — must get an auto-created
-- default workspace by the new migration's "ensure every user has a workspace" step.
INSERT INTO "User" ("id", "email", "tokenVersion", "createdAt", "updatedAt")
VALUES ('user-orphaned-membership', 'orphaned@example.com', 0, now(), now());

-- Jane's own ContentItem/Post/Flow/Competitor (FK-protected tables) — must end up
-- in ws-jane, not demo-user's workspace.
INSERT INTO "ContentItem" ("id", "type", "tema", "hashtags", "tags", "platforms", "userId", "createdAt", "updatedAt")
VALUES ('ci-jane-1', 'SOCIAL', 'jane topic', '{}', '{}', '{}', 'user-jane', now(), now());

INSERT INTO "Post" ("id", "userId", "content", "scheduledAt", "status", "createdAt", "updatedAt")
VALUES ('post-jane-1', 'user-jane', 'Jane post', now() + interval '1 day', 'SCHEDULED', now(), now());

-- This user-with-no-membership's own Post — must land in their auto-created workspace.
INSERT INTO "Post" ("id", "userId", "content", "scheduledAt", "status", "createdAt", "updatedAt")
VALUES ('post-orphanmember-1', 'user-orphaned-membership', 'Post from user w/o membership', now() + interval '1 day', 'SCHEDULED', now(), now());

-- Genuinely orphaned userId (no matching User at all) in the 5 FK-less tables —
-- must be reassigned to demo-user's workspace.
INSERT INTO "GrowthGoal" ("id", "userId", "platform", "metric", "target", "deadline", "createdAt", "updatedAt")
VALUES ('goal-orphan-1', 'ghost-user-xyz', 'INSTAGRAM', 'followers', 1000, now() + interval '30 days', now(), now());

INSERT INTO "GrowthGoal" ("id", "userId", "platform", "metric", "target", "deadline", "createdAt", "updatedAt")
VALUES ('goal-jane-1', 'user-jane', 'INSTAGRAM', 'followers', 500, now() + interval '30 days', now(), now());

INSERT INTO "QueueSlot" ("id", "userId", "platform", "dayOfWeek", "hour", "minute", "isActive", "createdAt")
VALUES ('slot-orphan-1', 'ghost-user-xyz', 'INSTAGRAM', 1, 9, 0, true, now());

-- Two DIFFERENT orphaned userIds that both get reassigned to demo-user, both writing to a
-- 1:1 table (ContentBrain) -> must collapse to exactly one row for demo-user's workspace,
-- not violate the new unique constraint or silently keep two rows.
INSERT INTO "ContentBrain" ("id", "userId", "viralHooks", "viralTopics", "viralFormats", "bestHashtags", "optimalLength", "createdAt", "updatedAt")
VALUES ('cb-orphan-1', 'ghost-user-xyz', '[]', '[]', '[]', '[]', '{}', now(), now());
INSERT INTO "ContentBrain" ("id", "userId", "viralHooks", "viralTopics", "viralFormats", "bestHashtags", "optimalLength", "createdAt", "updatedAt")
VALUES ('cb-orphan-2', 'another-ghost-user', '[]', '[]', '[]', '[]', '{}', now(), now());

INSERT INTO "BrandProfile" ("id", "userId", "brandName", "niche", "tone", "alwaysUseWords", "neverUseWords", "fixedHashtags", "optimalTimes", "createdAt", "updatedAt")
VALUES ('bp-jane-1', 'user-jane', 'Jane Brand', 'fitness', 'CASUAL', '{}', '{}', '{}', '{}', now(), now());
