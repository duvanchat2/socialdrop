-- CreateTable
CREATE TABLE "GeneratedScript" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "hook" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "cta" TEXT,
    "hashtags" TEXT[],
    "tone" TEXT,
    "contentType" TEXT,
    "postId" TEXT,
    "likes" INTEGER,
    "saves" INTEGER,
    "reach" INTEGER,
    "follows" INTEGER,
    "engagementRate" DOUBLE PRECISION,
    "isViral" BOOLEAN NOT NULL DEFAULT false,
    "metricsAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GeneratedScript_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContentBrain" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "viralHooks" JSONB NOT NULL DEFAULT '[]',
    "viralTopics" JSONB NOT NULL DEFAULT '[]',
    "viralFormats" JSONB NOT NULL DEFAULT '[]',
    "bestHashtags" JSONB NOT NULL DEFAULT '[]',
    "optimalLength" JSONB NOT NULL DEFAULT '{}',
    "totalScripts" INTEGER NOT NULL DEFAULT 0,
    "viralCount" INTEGER NOT NULL DEFAULT 0,
    "avgEngagement" DOUBLE PRECISION,
    "accuracyScore" DOUBLE PRECISION,
    "lastLearnedAt" TIMESTAMP(3),
    "nextLearnAt" TIMESTAMP(3),
    "patternSummary" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContentBrain_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GeneratedScript_userId_idx" ON "GeneratedScript"("userId");

-- CreateIndex
CREATE INDEX "GeneratedScript_userId_isViral_idx" ON "GeneratedScript"("userId", "isViral");

-- CreateIndex
CREATE INDEX "GeneratedScript_publishedAt_idx" ON "GeneratedScript"("publishedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ContentBrain_userId_key" ON "ContentBrain"("userId");

-- CreateIndex
CREATE INDEX "ContentBrain_userId_idx" ON "ContentBrain"("userId");
