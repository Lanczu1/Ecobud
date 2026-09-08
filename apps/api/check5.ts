import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const admins = await prisma.user.findMany({ where: { role: 'admin' } });
  const events = await prisma.event.findMany();
  console.log('Admins:', admins.map(a => a.id));
  console.log('Events:', events.map(e => e.id));
}

main().catch(console.error).finally(() => prisma.$disconnect());
