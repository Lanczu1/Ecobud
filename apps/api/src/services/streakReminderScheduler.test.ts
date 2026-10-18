import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('../prismaClient', () => ({ prisma: { challenge: { count: vi.fn() }, user: { findMany: vi.fn() } } }));
vi.mock('./notificationService', () => ({ sendDirectNotification: vi.fn() }));

import { prisma } from '../prismaClient';
import { sendDirectNotification } from './notificationService';
import { sendStreakWarnings } from './streakReminderScheduler';

const day = 86400000;
const now = new Date('2026-10-18T01:00:00Z');
let clock = now;
let users: any[];
const resident = (id: string, remaining: number, changes = {}) => ({
  id, role: 'user', status: 'active', currentStreak: 1,
  lastChallengeAt: new Date(now.getTime() - 7 * day + remaining), streakRestoredAt: null, notifications: [], ...changes,
});

function matches(record: any, query: any): boolean {
  if (query === null || typeof query !== 'object') return record === query;
  return Object.entries(query).every(([key, value]: [string, any]) => {
    if (key === 'AND') return value.every((condition: any) => matches(record, condition));
    if (key === 'OR') return value.some((condition: any) => matches(record, condition));
    if (key === 'gt') return record !== null && record > value;
    if (key === 'gte') return record !== null && record >= value;
    if (key === 'lte') return record !== null && record <= value;
    if (key === 'startsWith') return typeof record === 'string' && record.startsWith(value);
    if (key === 'none') return !record.some((item: any) => matches(item, value));
    return matches(record?.[key], value);
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  clock = now;
  users = [];
  vi.mocked(prisma.challenge.count).mockResolvedValue(1);
  vi.mocked(prisma.user.findMany).mockImplementation(async ({ where, take }: any) => users.filter(user => matches(user, where)).slice(0, take));
  vi.mocked(sendDirectNotification).mockImplementation(async (params: any) => {
    users.find(user => user.id === params.userId).notifications.push({ notificationKey: params.notificationKey, createdAt: clock });
    return { id: 'queued' } as any;
  });
});

describe('two-stage streak push reminders', () => {
  it('queues each stage once, allowing the 1-day push after the 2-day push', async () => {
    users = [resident('resident', 2 * day)];
    await sendStreakWarnings(clock);
    await sendStreakWarnings(clock);
    expect(sendDirectNotification).toHaveBeenCalledTimes(1);
    expect(sendDirectNotification).toHaveBeenLastCalledWith(expect.objectContaining({ title: 'Your streak expires within 2 days', userId: 'resident', type: 'streak', priority: 'high' }));
    clock = new Date(now.getTime() + day);
    await sendStreakWarnings(clock);
    await sendStreakWarnings(clock);
    expect(sendDirectNotification).toHaveBeenCalledTimes(2);
    expect(sendDirectNotification).toHaveBeenLastCalledWith(expect.objectContaining({ title: 'Your streak expires within 24 hours', userId: 'resident', priority: 'high' }));
    const keys = vi.mocked(sendDirectNotification).mock.calls.map(([params]) => params.notificationKey);
    expect(new Set(keys).size).toBe(2);
  });

  it.each([
    [2 * day, 'Your streak expires within 2 days'], [day + 1, 'Your streak expires within 2 days'],
    [day, 'Your streak expires within 24 hours'], [1, 'Your streak expires within 24 hours'],
  ])('selects the correct stage at %s ms remaining', async (remaining, title) => {
    users = [resident('resident', remaining)];
    await sendStreakWarnings(now);
    expect(sendDirectNotification).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ title }));
  });

  it.each([0, -1, 2 * day + 1])('does not notify outside the warning window: %s', async remaining => {
    users = [resident('resident', remaining)];
    await sendStreakWarnings(now);
    expect(sendDirectNotification).not.toHaveBeenCalled();
  });

  it('does not resend an existing legacy 2-day warning and still sends the 1-day reminder', async () => {
    const user = resident('resident', 2 * day);
    user.notifications = [{ notificationKey: `streak-warning:${user.lastChallengeAt.getTime()}`, createdAt: now }] as any;
    users = [user];
    await sendStreakWarnings(now);
    expect(sendDirectNotification).not.toHaveBeenCalled();
    clock = new Date(now.getTime() + day);
    await sendStreakWarnings(clock);
    expect(sendDirectNotification).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ title: 'Your streak expires within 24 hours' }));
  });

  it('does not send obsolete warnings after a restore or new completed challenge', async () => {
    users = [
      resident('restored', day, { streakRestoredAt: now }),
      resident('completed', day, { streakRestoredAt: new Date(now.getTime() - 6 * day), lastChallengeAt: now }),
    ];
    await sendStreakWarnings(now);
    expect(sendDirectNotification).not.toHaveBeenCalled();
  });

  it('starts a fresh reminder cycle after a restore', async () => {
    users = [resident('restored', day, { streakRestoredAt: now })];
    clock = new Date(now.getTime() + 5 * day);
    await sendStreakWarnings(clock);
    clock = new Date(now.getTime() + 6 * day);
    await sendStreakWarnings(clock);
    expect(sendDirectNotification).toHaveBeenCalledTimes(2);
    expect(vi.mocked(sendDirectNotification).mock.calls.map(([params]) => params.notificationKey)).toEqual([
      `streak-warning:${now.getTime()}`, `streak-warning:1-day:${now.getTime()}`,
    ]);
  });

  it('does not let recently restored users fill the batch ahead of eligible residents', async () => {
    users = [...Array.from({ length: 200 }, (_, index) => resident(`restored-${index}`, day, { streakRestoredAt: now })), resident('eligible', day)];
    await sendStreakWarnings(now);
    expect(sendDirectNotification).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ userId: 'eligible' }));
  });

  it.each([{ currentStreak: 0 }, { status: 'suspended' }, { role: 'moderator' }])('excludes ineligible accounts: %j', async changes => {
    users = [resident('resident', day, changes)];
    await sendStreakWarnings(now);
    expect(sendDirectNotification).not.toHaveBeenCalled();
  });

  it.each([1, 2])('sends both warning pushes for a %s-challenge streak', async currentStreak => {
    users = [resident('resident', 2 * day, { currentStreak })];
    await sendStreakWarnings(now);
    clock = new Date(now.getTime() + day);
    await sendStreakWarnings(clock);
    expect(sendDirectNotification).toHaveBeenCalledTimes(2);
    expect(vi.mocked(sendDirectNotification).mock.calls.map(([params]) => params.title)).toEqual(['Your streak expires within 2 days', 'Your streak expires within 24 hours']);
  });

  it('retries a stage if notification creation failed', async () => {
    users = [resident('resident', day)];
    vi.mocked(sendDirectNotification).mockResolvedValueOnce(null);
    await sendStreakWarnings(now);
    await sendStreakWarnings(now);
    expect(sendDirectNotification).toHaveBeenCalledTimes(2);
  });

  it('keeps the existing daytime delivery window and requires an available challenge', async () => {
    users = [resident('resident', day)];
    await sendStreakWarnings(new Date('2026-10-18T13:00:00Z'));
    expect(prisma.user.findMany).not.toHaveBeenCalled();
    vi.mocked(prisma.challenge.count).mockResolvedValue(0);
    await sendStreakWarnings(now);
    expect(sendDirectNotification).not.toHaveBeenCalled();
  });
});
