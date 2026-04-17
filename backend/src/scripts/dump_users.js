const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function dumpUsers() {
  const users = await prisma.user.findMany({
    select: { id: true, name: true, email: true, role: true, organizationId: true }
  });
  console.log(JSON.stringify(users, null, 2));
  await prisma.$disconnect();
}

dumpUsers();
