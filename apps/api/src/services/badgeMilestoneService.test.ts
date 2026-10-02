import { describe, it, expect, vi } from 'vitest';
import { awardMilestoneBadges, badgeMilestoneProgress } from './badgeMilestoneService';

function database(lessons = 1) {
  return {
    badge: { findMany: vi.fn(async () => [{ id: 'badge', awardType: 'lessons_completed', targetCount: 5, bonusPoints: 50 }]) },
    userLessonProgress: { count: vi.fn(async () => lessons) },
    challengeSubmission: { findMany: vi.fn(async () => [{ challengeInstance: { challengeId: 'one' } }, { challengeInstance: { challengeId: 'one' } }, { challengeInstance: { challengeId: 'two' } }]) },
    eventRegistration: { findMany: vi.fn(async () => [{ eventId: 'event' }]) },
    swapRequest: { count: vi.fn(async () => 2) },
    userBadge: { createMany: vi.fn(async () => ({ count: 1 })) },
    rewardTransaction: { create: vi.fn() },
  };
}
describe('badge milestones', () => {
  it('keeps the first lesson at 1/5 without awarding', async () => {
    const db = database();
    expect((await badgeMilestoneProgress(db as any, 'user')).lessons_completed).toBe(1);
    expect(await awardMilestoneBadges(db as any, 'user')).toEqual({ badges: [], bonusPoints: 0 });
    expect(db.userBadge.createMany).not.toHaveBeenCalled();
  });
  it('awards at five lessons and records the one-time bonus', async () => {
    const db = database(5);
    expect((await awardMilestoneBadges(db as any, 'user')).bonusPoints).toBe(50);
    expect(db.rewardTransaction.create).toHaveBeenCalledWith({ data: { userId: 'user', type: 'exp', amount: 50 } });
    db.userBadge.createMany.mockResolvedValue({ count: 0 });
    db.rewardTransaction.create.mockClear();
    expect(await awardMilestoneBadges(db as any, 'user')).toEqual({ badges: [], bonusPoints: 0 });
    expect(db.rewardTransaction.create).not.toHaveBeenCalled();
  });
  it('counts distinct challenges, claimed events and completed non-giveaway swaps', async () => {
    const db = database();
    expect(await badgeMilestoneProgress(db as any, 'user')).toMatchObject({ challenges_completed: 2, events_completed: 1, swaps_completed: 2 });
    expect(db.challengeSubmission.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: 'user', rewardAwarded: true } }));
    expect(db.eventRegistration.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: 'user', status: 'REWARD_CLAIMED' }, distinct: ['eventId'] }));
    expect(db.swapRequest.count).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ status: 'completed', listing: expect.objectContaining({ approvalStatus: 'approved' }) }) }));
  });
  it('does not award inactive or absent milestones', async () => {
    const db = database(10);
    db.badge.findMany.mockResolvedValue([]);
    expect(await awardMilestoneBadges(db as any, 'user')).toEqual({ badges: [], bonusPoints: 0 });
    expect(db.badge.findMany).toHaveBeenCalledWith({ where: { active: true, awardType: { in: ['lessons_completed', 'challenges_completed', 'events_completed', 'swaps_completed'] } } });
    expect(db.userLessonProgress.count).not.toHaveBeenCalled();
  });
});
