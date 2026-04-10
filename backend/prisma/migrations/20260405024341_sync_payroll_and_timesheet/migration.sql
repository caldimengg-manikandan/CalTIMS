/*
  Warnings:

  - You are about to drop the column `baseSalary` on the `PayrollProfile` table. All the data in the column will be lost.
  - You are about to drop the column `deductionsJSON` on the `PayrollProfile` table. All the data in the column will be lost.
  - You are about to drop the column `earningsJSON` on the `PayrollProfile` table. All the data in the column will be lost.
  - You are about to drop the column `netSalary` on the `ProcessedPayroll` table. All the data in the column will be lost.
  - You are about to drop the column `snapshotJSON` on the `ProcessedPayroll` table. All the data in the column will be lost.
  - You are about to drop the column `deductionsJSON` on the `RoleSalaryStructure` table. All the data in the column will be lost.
  - You are about to drop the column `earningsJSON` on the `RoleSalaryStructure` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[user]` on the table `PayrollProfile` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `month` to the `ProcessedPayroll` table without a default value. This is not possible if the table is not empty.
  - Added the required column `year` to the `ProcessedPayroll` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "ProcessedPayroll_organizationId_idx";

-- DropIndex
DROP INDEX "RoleSalaryStructure_organizationId_roleName_key";

-- AlterTable
ALTER TABLE "PayrollBatch" ADD COLUMN     "departmentDistribution" JSONB DEFAULT '{}',
ADD COLUMN     "errors" JSONB DEFAULT '[]',
ADD COLUMN     "executionSummary" TEXT,
ADD COLUMN     "failedCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "isPaid" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "paidAt" TIMESTAMP(3),
ADD COLUMN     "paidBy" TEXT,
ADD COLUMN     "processedBy" TEXT,
ADD COLUMN     "totalDeductions" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "totalEmployees" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "totalGross" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "totalNet" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "PayrollProfile" DROP COLUMN "baseSalary",
DROP COLUMN "deductionsJSON",
DROP COLUMN "earningsJSON",
ADD COLUMN     "deductions" JSONB DEFAULT '[]',
ADD COLUMN     "earnings" JSONB DEFAULT '[]',
ADD COLUMN     "monthlyCTC" DOUBLE PRECISION,
ADD COLUMN     "payrollType" TEXT DEFAULT 'Monthly',
ADD COLUMN     "profileVersion" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "salaryMode" TEXT DEFAULT 'Profile-Based',
ADD COLUMN     "salaryStructureId" TEXT,
ADD COLUMN     "user" TEXT;

-- AlterTable
ALTER TABLE "ProcessedPayroll" DROP COLUMN "netSalary",
DROP COLUMN "snapshotJSON",
ADD COLUMN     "attendance" JSONB DEFAULT '{}',
ADD COLUMN     "bankDetails" JSONB DEFAULT '{}',
ADD COLUMN     "breakdown" JSONB DEFAULT '{}',
ADD COLUMN     "currencySymbol" TEXT DEFAULT '₹',
ADD COLUMN     "employeeInfo" JSONB DEFAULT '{}',
ADD COLUMN     "grossYield" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "liability" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "month" INTEGER NOT NULL,
ADD COLUMN     "netPay" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "paidBy" TEXT,
ADD COLUMN     "paymentType" TEXT,
ADD COLUMN     "payslipTemplateId" TEXT,
ADD COLUMN     "processedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "profileVersion" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "userId" TEXT,
ADD COLUMN     "year" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "RoleSalaryStructure" DROP COLUMN "deductionsJSON",
DROP COLUMN "earningsJSON",
ADD COLUMN     "deductions" JSONB DEFAULT '[]',
ADD COLUMN     "earnings" JSONB DEFAULT '[]',
ADD COLUMN     "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "effectiveTo" TIMESTAMP(3),
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "isDeleted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "name" TEXT,
ADD COLUMN     "type" TEXT DEFAULT 'Role-Based',
ALTER COLUMN "roleName" DROP NOT NULL,
ALTER COLUMN "baseSalary" DROP NOT NULL,
ALTER COLUMN "baseSalary" SET DEFAULT 0;

-- CreateTable
CREATE TABLE "TimesheetWeek" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "weekStartDate" TIMESTAMP(3) NOT NULL,
    "weekEndDate" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "rows" JSONB NOT NULL DEFAULT '[]',
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TimesheetWeek_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TimesheetWeek_organizationId_weekStartDate_idx" ON "TimesheetWeek"("organizationId", "weekStartDate");

-- CreateIndex
CREATE UNIQUE INDEX "TimesheetWeek_userId_organizationId_weekStartDate_key" ON "TimesheetWeek"("userId", "organizationId", "weekStartDate");

-- CreateIndex
CREATE UNIQUE INDEX "PayrollProfile_user_key" ON "PayrollProfile"("user");

-- CreateIndex
CREATE INDEX "ProcessedPayroll_organizationId_month_year_idx" ON "ProcessedPayroll"("organizationId", "month", "year");

-- AddForeignKey
ALTER TABLE "TimesheetWeek" ADD CONSTRAINT "TimesheetWeek_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
