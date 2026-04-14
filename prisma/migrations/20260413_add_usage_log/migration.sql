-- CreateTable
CREATE TABLE "UsageLog" (
    "id"        TEXT NOT NULL,
    "tenantId"  TEXT NOT NULL,
    "userId"    TEXT,
    "action"    TEXT NOT NULL,
    "metadata"  TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UsageLog_pkey" PRIMARY KEY ("id")
);

-- Index para queries por tenant e por ação
CREATE INDEX "UsageLog_tenantId_idx" ON "UsageLog"("tenantId");
CREATE INDEX "UsageLog_action_createdAt_idx" ON "UsageLog"("action", "createdAt");
