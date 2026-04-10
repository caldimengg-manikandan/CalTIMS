/*
  Warnings:

  - A unique constraint covering the columns `[userId,organizationId]` on the table `Employee` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "budgetHours" DOUBLE PRECISION DEFAULT 0,
ADD COLUMN     "onlyProjectTasks" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "ProjectMember" ADD COLUMN     "allocationPercent" DOUBLE PRECISION NOT NULL DEFAULT 100,
ADD COLUMN     "budgetHours" DOUBLE PRECISION DEFAULT 0;

-- CreateIndex
CREATE UNIQUE INDEX "Employee_userId_organizationId_key" ON "Employee"("userId", "organizationId");
