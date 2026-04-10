-- CreateTable
CREATE TABLE "PayrollLedger" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "performedBy" TEXT NOT NULL,
    "metadata" JSONB DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PayrollLedger_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PayrollLedger_organizationId_createdAt_idx" ON "PayrollLedger"("organizationId", "createdAt");

-- AddForeignKey
ALTER TABLE "PayrollLedger" ADD CONSTRAINT "PayrollLedger_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
