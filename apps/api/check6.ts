import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const mods = await prisma.user.findMany({ where: { role: 'moderator' } });
  console.log('Moderators count:', mods.length);
  console.log('Abo mod:', mods.find(m => m.email === 'moderator.abo@ecobud.app')?.id);
}

main().catch(console.error).finally(() => prisma.$disconnect());
