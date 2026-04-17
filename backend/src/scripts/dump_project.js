const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function dumpProject() {
  const project = await prisma.project.findFirst({
    where: { code: 'DET-123' },
    include: {
      members: { include: { employee: { include: { user: true } } } }
    }
  });
  console.log(JSON.stringify(project, null, 2));
  await prisma.$disconnect();
}

dumpProject();
