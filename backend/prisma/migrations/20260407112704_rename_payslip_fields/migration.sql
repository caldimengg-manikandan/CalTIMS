/*
  Warnings:

  - You are about to drop the column `bankSnapshot` on the `Payslip` table. All the data in the column will be lost.
  - You are about to drop the column `breakdownSnapshot` on the `Payslip` table. All the data in the column will be lost.
  - You are about to drop the column `employeeSnapshot` on the `Payslip` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Payslip" DROP COLUMN "bankSnapshot",
DROP COLUMN "breakdownSnapshot",
DROP COLUMN "employeeSnapshot",
ADD COLUMN     "bankDetails" JSONB DEFAULT '{}',
ADD COLUMN     "breakdown" JSONB DEFAULT '{}',
ADD COLUMN     "employeeInfo" JSONB DEFAULT '{}';
