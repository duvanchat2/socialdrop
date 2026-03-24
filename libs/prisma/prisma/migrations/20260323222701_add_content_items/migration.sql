-- CreateEnum
CREATE TYPE "ContentType" AS ENUM ('SOCIAL', 'YT_SHORT', 'YT_LONG');

-- CreateTable
CREATE TABLE "ContentItem" (
    "id" TEXT NOT NULL,
    "type" "ContentType" NOT NULL,
    "tema" TEXT NOT NULL,
    "caption" TEXT,
    "hashtags" TEXT[],
    "title" TEXT,
    "tags" TEXT[],
    "thumbnailUrl" TEXT,
    "mediaDriveId" TEXT,
    "mediaUrl" TEXT,
    "platforms" "Platform"[],
    "scheduledAt" TIMESTAMP(3),
    "status" "PostStatus" NOT NULL DEFAULT 'DRAFT',
    "copyGenerated" BOOLEAN NOT NULL DEFAULT false,
    "n8nJobId" TEXT,
    "userId" TEXT NOT NULL DEFAULT 'demo-user',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContentItem_pkey" PRIMARY KEY ("id")
);
