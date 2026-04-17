const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function globalStats() {
  const total = await prisma.timesheetWeek.count();
  const orgs = await prisma.timesheetWeek.groupBy({
    by: ['organizationId'],
    _count: true
  });
  console.log('Total Sheets in system:', total);
  console.log('Orgs with sheets:', JSON.stringify(orgs, null, 2));
  await prisma.$disconnect();
}

globalStats();
