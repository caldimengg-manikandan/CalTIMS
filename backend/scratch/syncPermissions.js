'use strict';

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { ROLE_PERMISSIONS } = require('../src/constants/rolePermissions');

async function ensureAllModulesExistInDB() {
  console.log('🚀 Starting Permission Sync...');
  
  try {
    const organizations = await prisma.organization.findMany({
      select: { id: true, name: true }
    });
    
    console.log(`Found ${organizations.length} organizations.`);

    for (const org of organizations) {
      console.log(`\nSyncing for Org: ${org.name} (${org.id})`);
      
      for (const [roleName, standardPermissions] of Object.entries(ROLE_PERMISSIONS)) {
        // Find existing role record
        const existingRole = await prisma.role.findFirst({
          where: {
            organizationId: org.id,
            name: { equals: roleName, mode: 'insensitive' },
            isDeleted: false
          }
        });

        if (existingRole) {
          console.log(`- Updating permissions for role: ${roleName}`);
          
          // Merge existing permissions with standard ones (standard ones take precedence for the specific structure)
          // or just ensure the submodule exists.
          const currentPermissions = existingRole.permissions || {};
          
          // Deep merge logic simplified: ensure all modules and submodules from constants exist in DB
          const updatedPermissions = { ...currentPermissions };
          
          for (const [module, submodules] of Object.entries(standardPermissions)) {
            if (module === 'all') {
                updatedPermissions[module] = submodules;
                continue;
            }
            if (!updatedPermissions[module]) updatedPermissions[module] = {};
            
            for (const [submodule, actions] of Object.entries(submodules)) {
              if (!updatedPermissions[module][submodule]) {
                console.log(`  + Adding missing submodule: ${module} > ${submodule}`);
                updatedPermissions[module][submodule] = actions;
              } else {
                // Ensure all standard actions are present
                const currentActions = updatedPermissions[module][submodule];
                if (Array.isArray(currentActions)) {
                   const missingActions = actions.filter(a => !currentActions.includes(a));
                   if (missingActions.length > 0) {
                     console.log(`  + Adding missing actions to ${module} > ${submodule}: ${missingActions.join(', ')}`);
                     updatedPermissions[module][submodule] = [...currentActions, ...missingActions];
                   }
                }
              }
            }
          }

          await prisma.role.update({
            where: { id: existingRole.id },
            data: { permissions: updatedPermissions }
          });
        } else {
          console.log(`- Role ${roleName} not found for this org, skipping...`);
        }
      }
    }

    console.log('\n✅ Permission Sync Completed Successfully.');
  } catch (error) {
    console.error('❌ Error during sync:', error);
  } finally {
    await prisma.$disconnect();
  }
}

ensureAllModulesExistInDB();
