-- CreateTable
CREATE TABLE "Flow" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL DEFAULT 'demo-user',
    "name" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "trigger" TEXT NOT NULL,
    "keyword" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "nodes" JSONB NOT NULL DEFAULT '[]',
    "edges" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Flow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FlowExecution" (
    "id" TEXT NOT NULL,
    "flowId" TEXT NOT NULL,
    "triggeredBy" TEXT NOT NULL,
    "triggerType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'RUNNING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FlowExecution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contact" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL DEFAULT 'demo-user',
    "platform" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "username" TEXT,
    "name" TEXT,
    "tags" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Contact_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Flow_userId_idx" ON "Flow"("userId");
CREATE INDEX "Flow_userId_isActive_idx" ON "Flow"("userId", "isActive");
CREATE INDEX "FlowExecution_flowId_idx" ON "FlowExecution"("flowId");
CREATE INDEX "FlowExecution_triggeredBy_idx" ON "FlowExecution"("triggeredBy");
CREATE UNIQUE INDEX "Contact_platform_accountId_key" ON "Contact"("platform", "accountId");
CREATE INDEX "Contact_userId_idx" ON "Contact"("userId");

-- AddForeignKey
ALTER TABLE "FlowExecution" ADD CONSTRAINT "FlowExecution_flowId_fkey" FOREIGN KEY ("flowId") REFERENCES "Flow"("id") ON DELETE CASCADE ON UPDATE CASCADE;
