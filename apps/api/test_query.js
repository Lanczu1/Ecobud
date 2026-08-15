const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function test() {
  const now = new Date();
  const challengeTemplates = await prisma.challenge.findMany({
    where: { 
      active: true,
      OR: [
        { startDate: null },
        { startDate: { lte: now } }
      ],
      NOT: {
        endDate: { lte: now }
      }
    },
    orderBy: [{ difficulty: 'asc' }, { title: 'asc' }],
  });
  console.log(challengeTemplates);
}

test().finally(() => prisma.$disconnect());
