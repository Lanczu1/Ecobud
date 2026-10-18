import { describe, expect, it, vi } from 'vitest';
vi.mock('../prismaClient', () => ({ prisma: {} }));
import { StreakService } from './StreakService';
import { STREAK_MILESTONES, STREAK_WINDOW_MS, streakMonth, streakStatus } from '../utils/streakRules';
import { formatStreakTimeLeft, isStreakFlameActive, isStreakSummary, streakCountdownParts, streakExpiry } from '../../../mobile/src/shared/api/streakSummary';

const now = Date.parse('2026-10-18T12:00:00Z');
const hour = 3600000;
const summary = (remaining: number, active = true, currentStreak = 1) => ({ currentStreak, active, expiresAt: new Date(now + remaining).toISOString() });

describe('streak expiry warning', () => {
  it.each([
    [86400000, { days: 1, hours: 0, minutes: 0, seconds: 0 }],
    [90061000, { days: 1, hours: 1, minutes: 1, seconds: 1 }],
    [61000, { days: 0, hours: 0, minutes: 1, seconds: 1 }],
    [999, { days: 0, hours: 0, minutes: 0, seconds: 1 }],
    [0, { days: 0, hours: 0, minutes: 0, seconds: 0 }],
    [-1000, { days: 0, hours: 0, minutes: 0, seconds: 0 }],
  ])('splits the countdown without negative values: %s', (remaining, expected) => {
    expect(streakCountdownParts(remaining)).toEqual(expected);
  });
  it.each([48 * hour, 24 * hour, hour, 1])('warns with %s ms remaining', remaining => {
    expect(streakExpiry(summary(remaining), now)).toMatchObject({ active: true, warning: true, expired: false, remainingMs: remaining });
  });
  it('does not warn before the final 48 hours', () => {
    expect(streakExpiry(summary(48 * hour + 1), now).warning).toBe(false);
  });
  it.each([0, -1])('stops the warning and active flame at expiry: %s', remaining => {
    expect(streakExpiry(summary(remaining), now)).toMatchObject({ active: false, warning: false, expired: true });
  });
  it('does not warn for locked or inactive streaks', () => {
    expect(streakExpiry(summary(hour, true, 0), now).warning).toBe(false);
    expect(streakExpiry(summary(hour, false), now).warning).toBe(false);
  });
  it('does not invent an expiry date for an older API response', () => {
    expect(streakExpiry({ active: true, currentStreak: 3 }, now)).toMatchObject({ active: true, warning: false, remainingMs: null });
    expect(streakExpiry(null, now).warning).toBe(false);
  });
  it.each([
    [48 * hour, '2 days left'], [25 * hour, '1 day 1 hour left'],
    [90 * 60000, '1 hour 30 minutes left'], [60000, '1 minute left'], [1, 'Less than a minute left'],
  ])('formats %s ms as %s', (remaining, expected) => {
    expect(formatStreakTimeLeft(remaining)).toBe(expected);
  });
  it('validates an optional server expiry without rejecting older summaries', () => {
    const data = { ...summary(hour), restoresRemaining: 3, canRestore: false, lastChallengeAt: null, milestones: [{ challenges: 3, points: 30, ecoCoins: 0, badge: null, awarded: true }] };
    expect(isStreakSummary(data)).toBe(true);
    expect(isStreakSummary({ ...data, expiresAt: undefined })).toBe(true);
    expect(isStreakSummary({ ...data, expiresAt: 'invalid' })).toBe(false);
  });
});

describe('server streak expiry', () => {
  const user = { currentStreak: 1, lastChallengeAt: new Date(now - 6 * 24 * hour), streakRestoredAt: null, streakRestoreMonth: null, streakRestoresUsed: 0, streakMilestones: [] };
  const read = async (changes = {}) => {
    const database = { user: { findUnique: vi.fn().mockResolvedValue({ ...user, ...changes }) } };
    return new StreakService(database as any).summary('resident');
  };
  it('expires seven days after the last completed challenge', async () => {
    expect((await read()).expiresAt?.getTime()).toBe(user.lastChallengeAt.getTime() + STREAK_WINDOW_MS);
  });
  it('uses the latest restore when it is newer than the completion', async () => {
    const result = await read({ streakRestoredAt: new Date(now) });
    expect(result.expiresAt?.getTime()).toBe(now + STREAK_WINDOW_MS);
    expect(streakExpiry({ ...result, expiresAt: result.expiresAt?.toISOString() }, now).warning).toBe(false);
  });
  it('uses a completed challenge when it is newer than the restore', async () => {
    const result = await read({ streakRestoredAt: new Date(now - 8 * 24 * hour) });
    expect(result.expiresAt?.getTime()).toBe(user.lastChallengeAt.getTime() + STREAK_WINDOW_MS);
  });
  it('does not expose a deadline before the flame unlocks or without activity', async () => {
    expect((await read({ currentStreak: 0 })).expiresAt).toBeNull();
    expect((await read({ lastChallengeAt: null })).expiresAt).toBeNull();
  });
  it.each([1, 2])('starts the server and mobile timer with %s completed challenges', async currentStreak => {
    const result = await read({ currentStreak, lastChallengeAt: new Date(now) });
    expect(result.expiresAt?.getTime()).toBe(now + STREAK_WINDOW_MS);
    expect(streakStatus({ ...user, currentStreak, lastChallengeAt: new Date(now) }, new Date(now)).active).toBe(true);
    expect(isStreakFlameActive(currentStreak, true)).toBe(true);
    expect(streakExpiry({ ...result, active: true, expiresAt: result.expiresAt?.toISOString() }, now)).toMatchObject({ active: true, warning: false });
  });
  it.each([1, 2])('allows restore after seven days for a %s-challenge streak without clearing its count', currentStreak => {
    const status = streakStatus({ ...user, currentStreak, lastChallengeAt: new Date(now - STREAK_WINDOW_MS) }, new Date(now));
    expect(status).toMatchObject({ active: false, canRestore: true, restoresRemaining: 3 });
    expect(isStreakFlameActive(currentStreak, false)).toBe(false);
  });
  it('keeps the first bonus milestone at three challenges', () => {
    expect(STREAK_MILESTONES.map(item => item.challenges)).toEqual([3, 10, 30, 100]);
  });
});

describe('restore after the first completed challenge', () => {
  const databaseFor = (currentStreak: number, streakRestoresUsed = 0) => {
    const user = { currentStreak, lastChallengeAt: new Date(Date.now() - 8 * 86400000), streakRestoredAt: null as Date | null, streakRestoreMonth: streakMonth(new Date()), streakRestoresUsed, streakMilestones: [] };
    const database = {
      user: { findUnique: vi.fn(async () => user), update: vi.fn(async ({ data }: any) => Object.assign(user, data)) },
      $queryRaw: vi.fn().mockResolvedValue([]),
      $transaction: vi.fn(),
    };
    database.$transaction.mockImplementation(async (callback: any) => callback(database));
    return { database, user, service: new StreakService(database as any) };
  };
  it.each([1, 2])('reactivates a %s-challenge streak and preserves the count', async count => {
    const { service, user } = databaseFor(count);
    const result = await service.restore('resident');
    expect(result).toMatchObject({ currentStreak: count, active: true, canRestore: false, restoresRemaining: 2 });
    expect(result.expiresAt?.getTime()).toBe(user.streakRestoredAt!.getTime() + STREAK_WINDOW_MS);
  });
  it('does not restore a streak before the first completion', async () => {
    const { service, database } = databaseFor(0);
    await expect(service.restore('resident')).rejects.toThrow('Complete your first challenge');
    expect(database.user.update).not.toHaveBeenCalled();
  });
  it('keeps the three-restore monthly limit after the first completion', async () => {
    const { service, database } = databaseFor(1, 3);
    await expect(service.restore('resident')).rejects.toThrow('all 3 restores');
    expect(database.user.update).not.toHaveBeenCalled();
  });
});
