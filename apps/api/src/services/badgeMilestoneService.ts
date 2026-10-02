import { Prisma } from '@prisma/client';

export const milestoneTypes = ['lessons_completed', 'challenges_completed', 'events_completed', 'swaps_completed'] as const;

export async function badgeMilestoneProgress(tx: Prisma.TransactionClient, userId: string): Promise<Record<string, number>> {
  const [lessons, challenges, events, swaps] = await Promise.all([
    tx.userLessonProgress.count({ where: { userId, status: 'completed' } }),
    tx.challengeSubmission.findMany({ where: { userId, rewardAwarded: true }, select: { challengeInstance: { select: { challengeId: true } } } }),
    tx.eventRegistration.findMany({ where: { userId, status: 'REWARD_CLAIMED' }, select: { eventId: true }, distinct: ['eventId'] }),
    tx.swapRequest.count({ where: { status: 'completed', OR: [{ fromUserId: userId }, { toUserId: userId }], listing: { approvalStatus: 'approved', NOT: { lookingFor: { equals: 'giveaway', mode: 'insensitive' } } } } }),
  ]);
  return { lessons_completed: lessons, challenges_completed: new Set(challenges.map(row => row.challengeInstance.challengeId)).size, events_completed: events.length, swaps_completed: swaps };
}

// Callers hold the user's row lock so concurrent claims cannot award twice.
export async function awardMilestoneBadges(tx: Prisma.TransactionClient, userId: string) {
  const badges = await tx.badge.findMany({ where: { active: true, awardType: { in: [...milestoneTypes] } } });
  if (!badges.length) return { badges: [], bonusPoints: 0 };
  const progress = await badgeMilestoneProgress(tx, userId);
  const awarded = [];
  for (const badge of badges) {
    if ((progress[badge.awardType] ?? 0) < badge.targetCount) continue;
    const result = await tx.userBadge.createMany({ data: [{ userId, badgeId: badge.id }], skipDuplicates: true });
    if (result.count) awarded.push(badge);
  }
  const bonusPoints = awarded.reduce((sum, badge) => sum + badge.bonusPoints, 0);
  if (bonusPoints) await tx.rewardTransaction.create({ data: { userId, type: 'exp', amount: bonusPoints } });
  return { badges: awarded, bonusPoints };
}
