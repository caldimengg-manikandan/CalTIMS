'use strict';
const { prisma } = require('./src/config/database');

async function diagUser(email) {
  try {
    const user = await prisma.user.findUnique({
      where: { email },
      include: { roleRef: true }
    });

    if (!user) {
      console.log(`❌ User with email ${email} not found.`);
      return;
    }

    console.log(`\n=== User Diagnostics for ${email} ===`);
    console.log(`Name: ${user.name}`);
    console.log(`Role (String): ${user.role}`);
    console.log(`Role ID: ${user.roleId}`);
    console.log(`Is Owner: ${user.isOwner}`);
    console.log(`Is Active: ${user.isActive}`);
    console.log(`Organization ID: ${user.organizationId}`);
    
    if (user.roleRef) {
      console.log(`\nRole Reference Name: ${user.roleRef.name}`);
      console.log(`Permissions: ${JSON.stringify(user.roleRef.permissions, null, 2)}`);
    } else {
      console.log(`\n⚠️ No role reference found in DB.`);
    }

    console.log('====================================\n');
  } catch (err) {
    console.error(`Error: ${err.message}`);
  } finally {
    process.exit(0);
  }
}

const email = process.argv[2];
if (!email) {
  console.log('Please provide an email: node diag_user.js <email>');
  process.exit(1);
}

diagUser(email);
