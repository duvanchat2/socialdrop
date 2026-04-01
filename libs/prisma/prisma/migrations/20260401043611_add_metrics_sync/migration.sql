-- CreateTable
CREATE TABLE "PlatformMetrics" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "followersCount" INTEGER NOT NULL,
    "followingCount" INTEGER,
    "postsCount" INTEGER,
    "reachTotal" INTEGER,
    "impressionsTotal" INTEGER,
    "engagementRate" DOUBLE PRECISION,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlatformMetrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PostAnalytics" (
    "id" TEXT NOT NULL,
    "postId" TEXT,
    "userId" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "platformPostId" TEXT NOT NULL,
    "caption" TEXT,
    "mediaUrl" TEXT,
    "likes" INTEGER NOT NULL DEFAULT 0,
    "comments" INTEGER NOT NULL DEFAULT 0,
    "shares" INTEGER NOT NULL DEFAULT 0,
    "saves" INTEGER NOT NULL DEFAULT 0,
    "reach" INTEGER NOT NULL DEFAULT 0,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "views" INTEGER NOT NULL DEFAULT 0,
    "engagementRate" DOUBLE PRECISION,
    "publishedAt" TIMESTAMP(3),
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PostAnalytics_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PlatformMetrics_userId_platform_idx" ON "PlatformMetrics"("userId", "platform");

-- CreateIndex
CREATE INDEX "PlatformMetrics_recordedAt_idx" ON "PlatformMetrics"("recordedAt");

-- CreateIndex
CREATE INDEX "PostAnalytics_userId_platform_idx" ON "PostAnalytics"("userId", "platform");

-- CreateIndex
CREATE INDEX "PostAnalytics_recordedAt_idx" ON "PostAnalytics"("recordedAt");

-- CreateIndex
CREATE UNIQUE INDEX "PostAnalytics_userId_platform_platformPostId_key" ON "PostAnalytics"("userId", "platform", "platformPostId");
