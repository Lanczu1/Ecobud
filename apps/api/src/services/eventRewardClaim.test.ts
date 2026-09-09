import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../prismaClient', () => ({ prisma: {} }));
vi.mock('./notificationService', () => ({ sendDirectNotification: vi.fn() }));
vi.mock('./supabaseRealtimeService', () => ({ supabaseRealtimeService: {
  publishUserSectionRefresh: vi.fn(), publishAdminSectionBundle: vi.fn(),
} }));
import { GamificationService } from './GamificationService';
import { supabaseRealtimeService } from './supabaseRealtimeService';

const db = {
  $transaction: vi.fn(),
  event: { findUnique: vi.fn() },
  eventRegistration: { findUnique: vi.fn(), updateMany: vi.fn() },
  user: { findUnique: vi.fn(), update: vi.fn() },
  userStats: { upsert: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
  rewardTransaction: { create: vi.fn() },
  userBadge: { findMany: vi.fn() }, badge: { findMany: vi.fn() },
  profile: { findUnique: vi.fn() },
  transparencyLog: { findFirst: vi.fn(), create: vi.fn() },
};
const service = new GamificationService(db as any);
beforeEach(() => {
  vi.resetAllMocks();
  db.$transaction.mockImplementation(async run => run(db));
  db.event.findUnique.mockResolvedValue({ id: 'event', title: 'Cleanup', location: 'Hall', expReward: 100, ecoCoinsReward: 10 });
  db.eventRegistration.findUnique.mockResolvedValue({ id: 'registration', eventId: 'event', userId: 'member', status: 'ATTENDED' });
  db.eventRegistration.updateMany.mockResolvedValue({ count: 1 });
  db.user.findUnique.mockResolvedValue({ id: 'member', points: 20, currentStreak: 0, lastActionDate: null });
  db.user.update.mockResolvedValue({ id: 'member', points: 120, currentStreak: 1 });
  db.userStats.findUnique.mockResolvedValue({ knowledgePoints: 0 });
  db.userStats.update.mockResolvedValue({ knowledgePoints: 0 });
  db.userBadge.findMany.mockResolvedValue([]);
  db.badge.findMany.mockResolvedValue([]);
  db.transparencyLog.create.mockResolvedValue({ currentHash: 'hash' });
});

describe('event reward claims', () => {
  it('awards the configured points and coins with history and a ledger entry', async () => {
    const result = await service.markEventAttendance('event', 'registration');
    expect(result).toMatchObject({ alreadyCompleted: false, pointsAwarded: 100, ecoCoinsAwarded: 10, pointsTotal: 120 });
    expect(db.user.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ points: { increment: 100 } }) }));
    expect(db.userStats.upsert).toHaveBeenCalledWith(expect.objectContaining({ update: { ecoCoins: { increment: 10 } } }));
    expect(db.rewardTransaction.create).toHaveBeenCalledWith({ data: { userId: 'member', eventId: 'event', type: 'exp', amount: 100 } });
    expect(db.rewardTransaction.create).toHaveBeenCalledWith({ data: { userId: 'member', eventId: 'event', type: 'eco_coins', amount: 10 } });
    expect(db.transparencyLog.create).toHaveBeenCalledOnce();
    expect(db.$transaction).toHaveBeenCalledWith(expect.any(Function), { maxWait: 10000, timeout: 30000 });
  });
  it.each(['REGISTERED', 'PENDING_APPROVAL'])('still requires approval for %s', async status => {
    db.eventRegistration.findUnique.mockResolvedValue({ eventId: 'event', userId: 'member', status });
    await expect(service.markEventAttendance('event', 'registration')).rejects.toMatchObject({ statusCode: 400 });
    expect(db.user.update).not.toHaveBeenCalled();
  });
  it('does not award an already claimed reward again', async () => {
    db.eventRegistration.findUnique.mockResolvedValue({ eventId: 'event', status: 'REWARD_CLAIMED' });
    expect(await service.markEventAttendance('event', 'registration')).toMatchObject({ alreadyCompleted: true });
    expect(db.user.update).not.toHaveBeenCalled();
  });
  it('does not award again when a concurrent claim wins', async () => {
    db.eventRegistration.updateMany.mockResolvedValue({ count: 0 });
    expect(await service.markEventAttendance('event', 'registration')).toMatchObject({ alreadyCompleted: true });
    expect(db.eventRegistration.updateMany).toHaveBeenCalledWith({ where: { id: 'registration', status: 'ATTENDED' }, data: { status: 'REWARD_CLAIMED' } });
    expect(db.rewardTransaction.create).not.toHaveBeenCalled();
    expect(db.user.update).not.toHaveBeenCalled();
  });
  it('returns the committed reward even if realtime refresh fails', async () => {
    vi.mocked(supabaseRealtimeService.publishUserSectionRefresh).mockRejectedValue(new Error('Channel cleanup failed'));
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      expect(await service.markEventAttendance('event', 'registration')).toMatchObject({ pointsAwarded: 100, ecoCoinsAwarded: 10 });
      expect(log).toHaveBeenCalledWith('Event reward refresh failed after claim committed.', expect.any(Error));
    } finally { log.mockRestore(); }
  });
  it('propagates a failed reward write without publishing success', async () => {
    db.rewardTransaction.create.mockRejectedValue(new Error('Database unavailable'));
    await expect(service.markEventAttendance('event', 'registration')).rejects.toThrow('Database unavailable');
    expect(supabaseRealtimeService.publishUserSectionRefresh).not.toHaveBeenCalled();
  });
});
