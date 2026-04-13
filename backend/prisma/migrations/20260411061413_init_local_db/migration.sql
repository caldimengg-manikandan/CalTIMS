-- AlterTable
ALTER TABLE "Payslip" ADD COLUMN     "deductions" JSONB DEFAULT '[]',
ADD COLUMN     "earnings" JSONB DEFAULT '[]',
ADD COLUMN     "gross" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "netPay" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "totalDeductions" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "ProcessedPayroll" ADD COLUMN     "deductions" JSONB DEFAULT '[]',
ADD COLUMN     "earnings" JSONB DEFAULT '[]';

-- AlterTable
ALTER TABLE "Role" ADD COLUMN     "isSystem" BOOLEAN NOT NULL DEFAULT false;
