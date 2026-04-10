'use strict';

const { PrismaClient } = require('@prisma/client');
const logger = require('../shared/utils/logger');

// Prisma Client singleton (prevents multiple instances in dev hot-reload)
let prisma;

if (!global.__prisma__) {
  global.__prisma__ = new PrismaClient({
    log: process.env.NODE_ENV === 'development'
      ? ['error', 'warn']
      : ['error'],
  });
}

prisma = global.__prisma__;

/**
 * connectDB — verify Prisma can reach PostgreSQL
 */
const connectDB = async () => {
  try {
    await prisma.$connect();
    logger.info('PostgreSQL connected via Prisma');
  } catch (err) {
    logger.error(`PostgreSQL connection error: ${err.message}`);
    process.exit(1);
  }
};

// Graceful disconnect on process exit
process.on('beforeExit', async () => {
  await prisma.$disconnect();
});

module.exports = { prisma, connectDB };
