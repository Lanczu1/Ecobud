import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { describe, expect, it, vi } from 'vitest';
import { streakMonth, streakStatus } from '../utils/streakRules';
import { StreakService } from './StreakService';
import { GamificationService } from './GamificationService';

vi.mock('./notificationService', () => ({ sendDirectNotification: vi.fn() }));
vi.mock('./TransparencyLedgerService', () => ({ TransparencyLedgerService: class { async appendLog() { return { currentHash: 'test' }; } } }));

const now = new Date('2026-10-01T00:00:00Z');
const inactiveUser = () => ({ id: 'alice', points: 0, currentStreak: 10, lastChallengeAt: new Date('2026-09-20T00:00:00Z'), streakRestoredAt: null as Date | null, streakRestoreMonth: '2026-10', streakRestoresUsed: 0, streakMilestones: [] });

describe('challenge streak rules', () => {
  it('turns gray at exactly seven days and keeps the count', () => {
    const user = { ...inactiveUser(), lastChallengeAt: new Date(now.getTime() - 7 * 86400000) };
    expect(streakStatus(user, now)).toMatchObject({ active: false, canRestore: true });
    expect(streakStatus(user, new Date(now.getTime() - 1)).active).toBe(true);
    expect(user.currentStreak).toBe(10);
  });
  it('resets restore allowance at Philippine month boundary', () => {
    const user = { ...inactiveUser(), streakRestoreMonth: '2026-09', streakRestoresUsed: 3 };
    expect(streakMonth(new Date('2026-09-30T15:59:59Z'))).toBe('2026-09');
    expect(streakStatus(user, new Date('2026-09-30T15:59:59Z')).restoresRemaining).toBe(0);
    expect(streakStatus(user, new Date('2026-09-30T16:00:00Z')).restoresRemaining).toBe(3);
    expect(streakStatus({ ...user, currentStreak: 0 }, now).canRestore).toBe(false);
  });
});

describe('restore service', () => {
  it('restores only status, does not charge active retries, and rejects the fourth use', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(now);
    try {
      const user = inactiveUser();
      const tx: any = { $queryRaw: vi.fn(), user: { findUnique: vi.fn(async () => user), update: vi.fn(async ({ data }) => Object.assign(user, data)) } };
      const service = new StreakService({ $transaction: async (fn: any) => fn(tx) } as any);
      for (let i = 1; i <= 3; i++) {
        user.streakRestoredAt = null;
        const result = await service.restore('alice');
        expect(result.active).toBe(true);
        expect(result.restoresRemaining).toBe(3 - i);
        expect(user.currentStreak).toBe(10);
        expect(user.points).toBe(0);
        await service.restore('alice');
        expect(user.streakRestoresUsed).toBe(i);
      }
      user.streakRestoredAt = null;
      await expect(service.restore('alice')).rejects.toThrow('all 3 restores');
    } finally { vi.useRealTimers(); }
  });
});

describe('milestone awards', () => {
  const setup = (count: number) => {
    const user = { ...inactiveUser(), currentStreak: count };
    const earned: any[] = [];
    const tx: any = {
      $queryRaw: vi.fn(),
      user: { findUnique: async () => user, update: async ({ data }: any) => { user.points += data.points.increment; user.currentStreak = data.currentStreak; if (data.lastChallengeAt) user.lastChallengeAt = data.lastChallengeAt; return user; } },
      streakMilestone: { findMany: async () => earned, create: async ({ data }: any) => { earned.push(data); } },
      rewardTransaction: { createMany: vi.fn() },
      userStats: { upsert: vi.fn() },
      badge: { upsert: vi.fn(async ({ create }: any) => create) },
      userBadge: { upsert: vi.fn() },
    };
    const service: any = new GamificationService({} as any);
    service.userStatsService.syncEcoPointsAndStreak = vi.fn(async () => ({ knowledgePoints: 0 }));
    service.unlockBadges = vi.fn(async () => []);
    const award = (metadata: any = { challengeId: 'challenge' }) => service.awardAction(tx, { userId: 'alice', actionType: 'test', pointsAwarded: 20, ecoCoinsAwarded: 0, metadata });
    return { user, earned, tx, award };
  };
  it.each([[2, 50, 0], [9, 150, 5], [29, 450, 20], [99, 1450, 70]])('awards eligible milestones at count %i once', async (count, points, coins) => {
    const { award, earned, tx } = setup(count);
    const result = await award();
    expect(result.pointsAwarded).toBe(points);
    expect(result.ecoCoinsAwarded).toBe(coins);
    const first = earned.length;
    const second = await award();
    expect(second.pointsAwarded).toBe(20);
    expect(earned).toHaveLength(first);
    if (count === 99) expect(tx.userBadge.upsert).toHaveBeenCalledOnce();
  });
  it('excludes lessons, habits, events, and repeat submissions from streak progress', async () => {
    const { award, user, earned } = setup(2);
    const lastChallenge = user.lastChallengeAt;
    for (const metadata of [{ lessonId: 'lesson' }, { habitId: 'habit' }, { eventId: undefined }, { challengeId: 'challenge', streakEligible: false }]) await award(metadata);
    expect(user.currentStreak).toBe(2);
    expect(user.lastChallengeAt).toBe(lastChallenge);
    expect(earned).toHaveLength(0);
  });
});

it('migrates existing completed challenges and prevents duplicate milestone records', async () => {
  const db = new PGlite();
  try {
    await db.exec(`CREATE TABLE users(id TEXT PRIMARY KEY, streak_count INTEGER); CREATE TABLE user_stats(user_id TEXT, current_streak INTEGER); CREATE TABLE "UserChallenge"("userId" TEXT, status TEXT, "completedAt" TIMESTAMP); INSERT INTO users VALUES ('alice',99),('bob',15); INSERT INTO user_stats VALUES ('alice',99),('bob',15); INSERT INTO "UserChallenge" VALUES ('alice','COMPLETED','2026-09-20'),('alice','COMPLETED','2026-09-21'),('alice','IN_PROGRESS',NULL);`);
    await db.exec(readFileSync('prisma/migrations/20261001000100_challenge_streak/migration.sql', 'utf8'));
    expect((await db.query('SELECT id, streak_count FROM users ORDER BY id')).rows).toEqual([{ id: 'alice', streak_count: 2 }, { id: 'bob', streak_count: 0 }]);
    expect((await db.query('SELECT current_streak FROM user_stats WHERE user_id=\'alice\'')).rows).toEqual([{ current_streak: 2 }]);
    await db.exec(`INSERT INTO "StreakMilestone"("userId", challenges) VALUES ('alice',3)`);
    await expect(db.exec(`INSERT INTO "StreakMilestone"("userId", challenges) VALUES ('alice',3)`)).rejects.toThrow();
  } finally { await db.close(); }
}, 30000);
