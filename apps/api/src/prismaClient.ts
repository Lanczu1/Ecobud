import { PrismaClient } from '@prisma/client';
import { createDatabaseAdapter } from './databaseAdapter';
import { authCache } from './lib/cache';

const sessionWrites = new Set(['update', 'updateMany', 'upsert', 'delete', 'deleteMany']);

// The extension only adds a query hook, so the client keeps the plain
// PrismaClient shape that services and transaction helpers are typed against.
const createPrismaClient = (): PrismaClient =>
  new PrismaClient({
    adapter: createDatabaseAdapter(),
    log: process.env.NODE_ENV === 'development' ? ['query', 'info', 'error', 'warn'] : ['error'],
  }).$extends({
    query: {
      // Any account or profile write can change role, status, barangay or session
      // version, so drop the cached session lookups instead of waiting for expiry.
      async $allOperations({ model, operation, args, query }) {
        const result = await query(args);
        if ((model === 'User' || model === 'Profile') && sessionWrites.has(operation)) {
          authCache.clear();
        }
        return result;
      },
    },
  }) as unknown as PrismaClient;

const globalForPrisma = globalThis as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
