const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkProjectMembers() {
  const orgId = '87e9880e-0038-4fe3-a975-f46fd83bd3d1';
  console.log('Checking projects for Org:', orgId);

  const projects = await prisma.project.findMany({
    where: { organizationId: orgId, isDeleted: false },
    include: {
      members: {
        include: {
          employee: {
            include: { user: true }
          }
        }
      }
    }
  });

  projects.forEach(p => {
    console.log(`Project: ${p.name} (${p.code}) - Members: ${p.members.length}`);
    p.members.forEach(m => {
      console.log(`  - ${m.employee.user?.name || 'NAMELESS'} (User UUID: ${m.employee.user?.id})`);
    });
  });

  await prisma.$disconnect();
}

checkProjectMembers();
