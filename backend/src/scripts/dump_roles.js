const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function dumpRoles() {
  const roles = await prisma.role.findMany();
  console.log(JSON.stringify(roles, null, 2));
  await prisma.$disconnect();
}

dumpRoles();
