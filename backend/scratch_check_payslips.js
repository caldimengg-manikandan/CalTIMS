const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkPayslips() {
  try {
    const payslips = await prisma.payslip.findMany({
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        id: true,
        isEmailSent: true,
        status: true,
        lastEmailSentAt: true,
        month: true,
        year: true,
        employeeInfo: true
      }
    });
    
    console.log(JSON.stringify(payslips, null, 2));
  } catch (err) {
    console.error(err);
  } finally {
    await prisma.$disconnect();
  }
}

checkPayslips();
