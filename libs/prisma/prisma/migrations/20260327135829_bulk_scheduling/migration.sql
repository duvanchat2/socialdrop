-- CreateEnum
CREATE TYPE "Tone" AS ENUM ('CASUAL', 'FORMAL', 'FUNNY', 'INSPIRATIONAL');

-- CreateTable
CREATE TABLE "BrandProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "brandName" TEXT NOT NULL DEFAULT '',
    "niche" TEXT NOT NULL DEFAULT '',
    "tone" "Tone" NOT NULL DEFAULT 'CASUAL',
    "alwaysUseWords" TEXT[],
    "neverUseWords" TEXT[],
    "fixedHashtags" TEXT[],
    "optimalTimes" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BrandProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContentStrategy" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "dayConfigs" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContentStrategy_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BrandProfile_userId_key" ON "BrandProfile"("userId");

-- CreateIndex
CREATE INDEX "BrandProfile_userId_idx" ON "BrandProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ContentStrategy_userId_key" ON "ContentStrategy"("userId");

-- CreateIndex
CREATE INDEX "ContentStrategy_userId_idx" ON "ContentStrategy"("userId");
