const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.profile.findFirst({where: {displayName: 'Lanczu2'}}).then(console.log).finally(() => prisma.$disconnect());
