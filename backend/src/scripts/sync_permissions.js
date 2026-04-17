const { PrismaClient } = require('@prisma/client');
const { ROLE_PERMISSIONS } = require('../constants/rolePermissions');

const prisma = new PrismaClient();

async function syncPermissions() {
  console.log('Starting permission sync...');
  
  try {
    // Get all organizations to sync roles for each
    const organizations = await prisma.organization.findMany({
      select: { id: true, name: true }
    });
    
    console.log(`Found ${organizations.length} organizations.`);

    for (const org of organizations) {
      console.log(`Syncing roles for organization: ${org.name} (${org.id})`);
      
      for (const [roleName, permissions] of Object.entries(ROLE_PERMISSIONS)) {
        // Find existing role or create it
        const existingRole = await prisma.role.findFirst({
          where: {
            organizationId: org.id,
            name: { equals: roleName, mode: 'insensitive' }
          }
        });

        if (existingRole) {
          console.log(`Updating permissions for role: ${roleName}`);
          await prisma.role.update({
            where: { id: existingRole.id },
            data: { permissions }
          });
        } else {
          console.log(`Creating missing role: ${roleName}`);
          await prisma.role.create({
            data: {
              name: roleName,
              organizationId: org.id,
              permissions,
              isSystem: true
            }
          });
        }
      }
    }

    console.log('Permission sync completed successfully.');
  } catch (error) {
    console.error('Error syncing permissions:', error);
  } finally {
    await prisma.$disconnect();
  }
}

syncPermissions();
