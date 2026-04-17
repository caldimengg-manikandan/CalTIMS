const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkRole() {
  const orgId = '87e9880e-0038-4fe3-a975-f46fd83bd3d1';
  const roleName = 'admin';
  console.log(`Checking role ${roleName} for Org: ${orgId}`);

  const role = await prisma.role.findFirst({
    where: {
      organizationId: orgId,
      name: { equals: roleName, mode: 'insensitive' }
    }
  });

  console.log('Role found:', JSON.stringify(role, null, 2));
  await prisma.$disconnect();
}

checkRole();
