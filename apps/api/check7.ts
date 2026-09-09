import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const migrations = await prisma.$queryRaw`SELECT migration_name, finished_at, rolled_back_at FROM _prisma_migrations`;
  console.log('MIGRATIONS:', migrations);
}

main().catch(console.error).finally(() => prisma.$disconnect());
