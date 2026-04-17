const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkHours() {
  const orgId = '87e9880e-0038-4fe3-a975-f46fd83bd3d1';
  console.log('Checking hours for Org:', orgId);

  const sheets = await prisma.timesheetWeek.findMany({
    where: { organizationId: orgId, status: { not: 'DRAFT' }, isDeleted: false },
    select: { id: true, rows: true, status: true }
  });

  console.log('Found sheets:', sheets.length);
  
  let totalHours = 0;
  sheets.forEach(ts => {
    const rows = Array.isArray(ts.rows) ? ts.rows : [];
    console.log(`Sheet ${ts.id} (${ts.status}) rows type: ${typeof ts.rows}, isArray: ${Array.isArray(ts.rows)}`);
    rows.forEach(row => {
      const entries = Array.isArray(row.entries) ? row.entries : [];
      entries.forEach(e => {
        const h = parseFloat(e.hoursWorked || e.hours || 0);
        totalHours += h;
      });
    });
  });

  console.log('Calculated Total Hours:', totalHours);
  await prisma.$disconnect();
}

checkHours();
