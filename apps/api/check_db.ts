import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const listings = await prisma.swapListing.findMany({
    select: { id: true, userId: true, images: true }
  });
  console.log(JSON.stringify(listings, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
