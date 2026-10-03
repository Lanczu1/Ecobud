import { prisma } from '../prismaClient';

export async function getTotalCoinsRedeemed(): Promise<number> {
  const result = await prisma.redeemRequest.aggregate({
    where: { status: 'claimed' },
    _sum: { coinCost: true },
  });
  return result._sum.coinCost ?? 0;
}
