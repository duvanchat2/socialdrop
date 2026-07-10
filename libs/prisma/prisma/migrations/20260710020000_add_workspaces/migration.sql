-- CreateEnum
CREATE TYPE "WorkspaceRole" AS ENUM ('OWNER', 'MEMBER');

-- AlterTable
ALTER TABLE "User" ADD COLUMN "lastActiveWorkspaceId" TEXT;

-- CreateTable
CREATE TABLE "Workspace" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Workspace_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkspaceMember" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "WorkspaceRole" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkspaceMember_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WorkspaceMember_workspaceId_userId_key" ON "WorkspaceMember"("workspaceId", "userId");

-- CreateIndex
CREATE INDEX "WorkspaceMember_userId_idx" ON "WorkspaceMember"("userId");

-- AddForeignKey
ALTER TABLE "WorkspaceMember" ADD CONSTRAINT "WorkspaceMember_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceMember" ADD CONSTRAINT "WorkspaceMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================================
-- Backfill: one default workspace + OWNER membership per existing User.
-- "demo-user" (if present) gets a workspace named 'Workspace Demo';
-- every other existing user gets one named after them (or 'Mi espacio').
-- No user or integration data is deleted by this migration.
--
-- A deterministic workspace id (derived from the user's id) is used
-- instead of joining on name, since two users can share the same
-- computed name (e.g. both NULL -> 'Mi espacio') and a name-based join
-- would misassign memberships.
-- ============================================================
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
FROM "User" u;

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
FROM "User" u;

UPDATE "User" u
SET "lastActiveWorkspaceId" = (
         substr(md5('workspace-for-user:' || u."id"), 1, 8) || '-' ||
         substr(md5('workspace-for-user:' || u."id"), 9, 4) || '-5' ||
         substr(md5('workspace-for-user:' || u."id"), 14, 3) || '-' ||
         substr(md5('workspace-for-user:' || u."id"), 17, 4) || '-' ||
         substr(md5('workspace-for-user:' || u."id"), 21, 12)
       )::uuid;

-- DropForeignKey (old Integration -> User)
ALTER TABLE "Integration" DROP CONSTRAINT "Integration_userId_fkey";

-- DropIndex (old unique/index keyed by userId)
DROP INDEX "Integration_userId_platform_profileId_key";
DROP INDEX "Integration_userId_idx";

-- AlterTable: add workspaceId, backfill from the owning user's default workspace, then drop userId
ALTER TABLE "Integration" ADD COLUMN "workspaceId" TEXT;

UPDATE "Integration" i
SET "workspaceId" = wm."workspaceId"
FROM "WorkspaceMember" wm
WHERE wm."userId" = i."userId";

ALTER TABLE "Integration" ALTER COLUMN "workspaceId" SET NOT NULL;
ALTER TABLE "Integration" DROP COLUMN "userId";

-- CreateIndex
CREATE UNIQUE INDEX "Integration_workspaceId_platform_profileId_key" ON "Integration"("workspaceId", "platform", "profileId");

-- CreateIndex
CREATE INDEX "Integration_workspaceId_idx" ON "Integration"("workspaceId");

-- AddForeignKey
ALTER TABLE "Integration" ADD CONSTRAINT "Integration_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
