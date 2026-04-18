-- CreateTable
CREATE TABLE "QueueSlot" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "platform" "Platform" NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "hour" INTEGER NOT NULL,
    "minute" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QueueSlot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "QueueSlot_userId_platform_idx" ON "QueueSlot"("userId", "platform");

-- CreateIndex
CREATE INDEX "QueueSlot_userId_dayOfWeek_hour_minute_idx" ON "QueueSlot"("userId", "dayOfWeek", "hour", "minute");
