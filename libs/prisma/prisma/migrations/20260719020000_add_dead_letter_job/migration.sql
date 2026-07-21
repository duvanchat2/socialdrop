-- CreateTable
CREATE TABLE "DeadLetterJob" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT,
    "queueName" TEXT NOT NULL,
    "jobName" TEXT NOT NULL,
    "jobData" JSONB NOT NULL,
    "reason" TEXT NOT NULL,
    "failedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "requeuedAt" TIMESTAMP(3),

    CONSTRAINT "DeadLetterJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DeadLetterJob_failedAt_idx" ON "DeadLetterJob"("failedAt");
