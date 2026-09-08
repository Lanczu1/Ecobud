import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany();
  console.log('Total users:', users.length);
  const events = await prisma.event.findMany();
  console.log('Events:', events.length);
}

main().catch(console.error).finally(() => prisma.$disconnect());
