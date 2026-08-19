import { PrismaClient } from '@prisma/client';
import { isProd } from './env';

/**
 * Single Prisma instance. Cached on globalThis so `tsx watch` reloads don't
 * exhaust the connection pool during development.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: isProd ? ['error'] : ['error', 'warn'],
  });

if (!isProd) globalForPrisma.prisma = prisma;
