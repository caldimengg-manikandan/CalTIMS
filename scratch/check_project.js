
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkProject() {
  const project = await prisma.project.findFirst({
    where: { code: 'TIM-005' },
    select: { id: true, name: true, code: true, startDate: true }
  });
  console.log('Project TIM-005:', project);
  process.exit(0);
}

checkProject();
