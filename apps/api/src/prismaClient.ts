import { PrismaClient } from '@prisma/client';
import { authCache } from './lib/cache';

const globalForPrisma = globalThis as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'info', 'error', 'warn'] : ['error'],
  });

if (!globalForPrisma.prisma) {
  const sessionWrites = new Set(['update', 'updateMany', 'upsert', 'delete', 'deleteMany']);
  // Any account or profile write can change role, status, barangay or session
  // version, so drop the cached session lookups instead of waiting for expiry.
  prisma.$use(async (params, next) => {
    const result = await next(params);
    if ((params.model === 'User' || params.model === 'Profile') && sessionWrites.has(params.action)) {
      authCache.clear();
    }
    return result;
  });
}

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
