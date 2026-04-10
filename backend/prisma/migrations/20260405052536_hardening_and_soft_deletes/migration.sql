/*
  Warnings:

  - You are about to drop the column `isSystem` on the `Role` table. All the data in the column will be lost.
  - You are about to drop the column `isSystemRole` on the `Role` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[id,organizationId]` on the table `Announcement` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[id,organizationId]` on the table `ApprovalRequest` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[id,organizationId]` on the table `Attendance` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[id,organizationId]` on the table `AuditLog` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[id,organizationId]` on the table `Document` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[id,organizationId]` on the table `Employee` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[id,organizationId]` on the table `Incident` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[id,organizationId]` on the table `Invoice` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[id,organizationId]` on the table `Leave` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[id,organizationId]` on the table `LeaveType` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[id,organizationId]` on the table `Notification` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[id,organizationId]` on the table `PayrollBatch` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[id,organizationId]` on the table `PayrollLedger` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[id,organizationId]` on the table `PayrollPolicy` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[id,organizationId]` on the table `PayrollProfile` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[id,organizationId]` on the table `ProcessedPayroll` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[id,organizationId]` on the table `Project` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[id,organizationId]` on the table `ReportSchedule` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[id,organizationId]` on the table `Role` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[id,organizationId]` on the table `RoleSalaryStructure` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[id,organizationId]` on the table `SupportTicket` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[id,organizationId]` on the table `Task` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[id,organizationId]` on the table `Timesheet` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[id,organizationId]` on the table `TimesheetWeek` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[id,organizationId]` on the table `User` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[id,organizationId]` on the table `Workflow` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Role" DROP COLUMN "isSystem",
DROP COLUMN "isSystemRole",
ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "isDeleted" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "SupportTicket" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "isDeleted" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "PayrollJob" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Pending',
    "payload" JSONB NOT NULL DEFAULT '{}',
    "priority" INTEGER NOT NULL DEFAULT 0,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "processedAt" TIMESTAMP(3),
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayrollJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PayrollJob_organizationId_status_idx" ON "PayrollJob"("organizationId", "status");

-- CreateIndex
CREATE INDEX "PayrollJob_status_priority_createdAt_idx" ON "PayrollJob"("status", "priority", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PayrollJob_id_organizationId_key" ON "PayrollJob"("id", "organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "Announcement_id_organizationId_key" ON "Announcement"("id", "organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "ApprovalRequest_id_organizationId_key" ON "ApprovalRequest"("id", "organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "Attendance_id_organizationId_key" ON "Attendance"("id", "organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "AuditLog_id_organizationId_key" ON "AuditLog"("id", "organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "Document_id_organizationId_key" ON "Document"("id", "organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "Employee_id_organizationId_key" ON "Employee"("id", "organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "Incident_id_organizationId_key" ON "Incident"("id", "organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_id_organizationId_key" ON "Invoice"("id", "organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "Leave_id_organizationId_key" ON "Leave"("id", "organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "LeaveType_id_organizationId_key" ON "LeaveType"("id", "organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "Notification_id_organizationId_key" ON "Notification"("id", "organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "PayrollBatch_id_organizationId_key" ON "PayrollBatch"("id", "organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "PayrollLedger_id_organizationId_key" ON "PayrollLedger"("id", "organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "PayrollPolicy_id_organizationId_key" ON "PayrollPolicy"("id", "organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "PayrollProfile_id_organizationId_key" ON "PayrollProfile"("id", "organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "ProcessedPayroll_id_organizationId_key" ON "ProcessedPayroll"("id", "organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "Project_id_organizationId_key" ON "Project"("id", "organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "ReportSchedule_id_organizationId_key" ON "ReportSchedule"("id", "organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "Role_id_organizationId_key" ON "Role"("id", "organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "RoleSalaryStructure_id_organizationId_key" ON "RoleSalaryStructure"("id", "organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "SupportTicket_id_organizationId_key" ON "SupportTicket"("id", "organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "Task_id_organizationId_key" ON "Task"("id", "organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "Timesheet_id_organizationId_key" ON "Timesheet"("id", "organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "TimesheetWeek_id_organizationId_key" ON "TimesheetWeek"("id", "organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "User_id_organizationId_key" ON "User"("id", "organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "Workflow_id_organizationId_key" ON "Workflow"("id", "organizationId");

-- AddForeignKey
ALTER TABLE "PayrollJob" ADD CONSTRAINT "PayrollJob_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
