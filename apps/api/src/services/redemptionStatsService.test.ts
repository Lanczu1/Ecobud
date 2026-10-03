import { beforeEach, describe, expect, it, vi } from 'vitest';

const { db } = vi.hoisted(() => ({ db: {
  redeemRequest: { aggregate: vi.fn() },
  user: { count: vi.fn(), aggregate: vi.fn() },
  lesson: { count: vi.fn() }, challenge: { count: vi.fn() },
  userLessonProgress: { count: vi.fn() }, challengeSubmission: { count: vi.fn() },
} }));
vi.mock('../prismaClient', () => ({ prisma: db }));
vi.mock('./presenceQueryService', () => ({ presenceQueryService: {
  getPresenceOverview: vi.fn().mockResolvedValue({ activeToday: 0, onlineUsers: [] }),
} }));
vi.mock('./supabaseRealtimeService', () => ({ supabaseRealtimeService: {} }));
vi.mock('./notificationService', () => ({ sendDirectNotification: vi.fn() }));

import { getTotalCoinsRedeemed } from './redemptionStatsService';
import { AdminService } from './adminService';
import { apiCache } from '../lib/cache';

beforeEach(() => {
  vi.clearAllMocks();
  apiCache.clear();
});

describe('redeemed coin totals', () => {
  it('sums historical request costs only after claim, excluding reserved and refunded coins', async () => {
    const records = [
      { status: 'claimed', coinCost: 100 }, { status: 'claimed', coinCost: 250 },
      { status: 'pending', coinCost: 1000 }, { status: 'approved', coinCost: 2000 },
      { status: 'ready_to_claim', coinCost: 3000 }, { status: 'rejected', coinCost: 4000 },
    ];
    db.redeemRequest.aggregate.mockImplementation(async ({ where }) => ({
      _sum: { coinCost: records.filter(row => row.status === where.status).reduce((total, row) => total + row.coinCost, 0) },
    }));
    expect(await getTotalCoinsRedeemed()).toBe(350);
  });

  it('returns zero when there are no claimed requests', async () => {
    db.redeemRequest.aggregate.mockResolvedValue({ _sum: { coinCost: null } });
    expect(await getTotalCoinsRedeemed()).toBe(0);
  });

  it('supplies the same redemption total to Dashboard and Reports without replacing points', async () => {
    db.user.count.mockResolvedValue(2);
    db.user.aggregate.mockResolvedValue({ _sum: { points: 17200 } });
    db.lesson.count.mockResolvedValue(0);
    db.challenge.count.mockResolvedValue(0);
    db.userLessonProgress.count.mockResolvedValue(0);
    db.challengeSubmission.count.mockResolvedValue(0);
    db.redeemRequest.aggregate.mockResolvedValue({ _sum: { coinCost: 350 } });
    vi.spyOn(AdminService, 'getSevenDayActivityTrend').mockResolvedValue([]);
    const result = await AdminService.getDashboardStats();
    expect(result.overview.totalCoinsRedeemed).toBe(await getTotalCoinsRedeemed());
    expect(result.overview.totalCoinsRedeemed).toBe(350);
    expect(result.overview.totalPoints).toBe(17200);
    vi.restoreAllMocks();
  });
});
