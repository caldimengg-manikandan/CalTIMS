/*
  Warnings:

  - A unique constraint covering the columns `[organizationId,leaveId]` on the table `Leave` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Leave" ADD COLUMN     "leaveId" TEXT,
ADD COLUMN     "processedById" TEXT,
ADD COLUMN     "rejectionReason" TEXT,
ADD COLUMN     "totalDays" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "PayrollPolicy" ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "PayrollProfile" ADD COLUMN     "annualCTC" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "isSystemType" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "type" TEXT NOT NULL DEFAULT 'project';

-- AlterTable
ALTER TABLE "Timesheet" ADD COLUMN     "entry_type" TEXT NOT NULL DEFAULT 'project';

-- CreateTable
CREATE TABLE "Payslip" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "processedPayrollId" TEXT NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'GENERATED',
    "netSalary" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "breakdownSnapshot" JSONB DEFAULT '{}',
    "employeeSnapshot" JSONB DEFAULT '{}',
    "bankSnapshot" JSONB DEFAULT '{}',
    "isEmailSent" BOOLEAN NOT NULL DEFAULT false,
    "lastEmailSentAt" TIMESTAMP(3),
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "generatedBy" TEXT,
    "paidAt" TIMESTAMP(3),
    "paidBy" TEXT,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payslip_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Payslip_processedPayrollId_key" ON "Payslip"("processedPayrollId");

-- CreateIndex
CREATE INDEX "Payslip_organizationId_month_year_idx" ON "Payslip"("organizationId", "month", "year");

-- CreateIndex
CREATE INDEX "Payslip_employeeId_idx" ON "Payslip"("employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "Payslip_id_organizationId_key" ON "Payslip"("id", "organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "Payslip_organizationId_month_year_employeeId_key" ON "Payslip"("organizationId", "month", "year", "employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "Leave_organizationId_leaveId_key" ON "Leave"("organizationId", "leaveId");

-- AddForeignKey
ALTER TABLE "Leave" ADD CONSTRAINT "Leave_processedById_fkey" FOREIGN KEY ("processedById") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payslip" ADD CONSTRAINT "Payslip_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payslip" ADD CONSTRAINT "Payslip_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payslip" ADD CONSTRAINT "Payslip_processedPayrollId_fkey" FOREIGN KEY ("processedPayrollId") REFERENCES "ProcessedPayroll"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
