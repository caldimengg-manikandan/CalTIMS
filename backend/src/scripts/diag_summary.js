const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function diagnoseSummary() {
  const orgId = '87e9880e-0038-4fe3-a975-f46fd83bd3d1'; 
  console.log('Diagnosing summary for Org:', orgId);

  const total = await prisma.timesheetWeek.count({ where: { organizationId: orgId, isDeleted: false } });
  const nonDraft = await prisma.timesheetWeek.count({ where: { organizationId: orgId, status: { not: 'DRAFT' }, isDeleted: false } });
  const statuses = await prisma.timesheetWeek.groupBy({
    by: ['status'],
    where: { organizationId: orgId, isDeleted: false },
    _count: true
  });

  console.log('Total Sheets:', total);
  console.log('Non-Draft Sheets:', nonDraft);
  console.log('Status Counts:', JSON.stringify(statuses, null, 2));

  await prisma.$disconnect();
}

diagnoseSummary();
