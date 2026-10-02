import { beforeEach, describe, expect, it, vi } from 'vitest';
const db = vi.hoisted(() => ({ $transaction: vi.fn(), $queryRaw: vi.fn(), swapRequest: { findUnique: vi.fn(), updateMany: vi.fn(), count: vi.fn() }, swapConversation: { updateMany: vi.fn() }, badge: { findFirst: vi.fn(), findMany: vi.fn() }, userBadge: { createMany: vi.fn() } }));
vi.mock('../prismaClient', () => ({ prisma: db }));
vi.mock('./notificationService', () => ({ sendDirectNotification: vi.fn(async () => {}) }));
import { swapService } from './swapService';
const listing = { approvalStatus: 'approved', lookingFor: 'giveaway' };
const request = { id: 'request', listingId: 'listing', fromUserId: 'receiver', toUserId: 'owner', status: 'accepted', listing };
beforeEach(() => {
  vi.resetAllMocks(); db.badge.findMany.mockResolvedValue([]); db.$transaction.mockImplementation(async run => run(db));
  db.swapRequest.findUnique.mockResolvedValue(request); db.swapRequest.updateMany.mockResolvedValue({ count: 1 });
  db.swapRequest.count.mockResolvedValue(1); db.userBadge.createMany.mockResolvedValue({ count: 1 });
  db.badge.findFirst.mockResolvedValue({ id: 'badge', name: 'Reuse Partner' });
});
describe('exchange badge rewards', () => {
  it('awards the listing badge to both giveaway participants', async () => {
    await swapService.updateSwapRequestStatus('request', 'owner', 'user', 'completed');
    expect(db.userBadge.createMany).toHaveBeenCalledWith({ data: [{ userId: 'receiver', badgeId: 'badge' }], skipDuplicates: true });
    expect(db.userBadge.createMany).toHaveBeenCalledWith({ data: [{ userId: 'owner', badgeId: 'badge' }], skipDuplicates: true });
  });
  it('preserves Giveaway Master for owners who reach ten completed giveaways', async () => {
    db.swapRequest.count.mockResolvedValue(10);
    db.badge.findFirst.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: 'master', name: 'Giveaway Master' });
    await swapService.updateSwapRequestStatus('request', 'owner', 'user', 'completed');
    expect(db.userBadge.createMany).toHaveBeenCalledWith({ data: [{ userId: 'owner', badgeId: 'master' }], skipDuplicates: true });
  });
  it('does not re-award completed requests', async () => {
    db.swapRequest.findUnique.mockResolvedValue({ ...request, status: 'completed' });
    await swapService.updateSwapRequestStatus('request', 'owner', 'user', 'completed');
    expect(db.$transaction).not.toHaveBeenCalled();
  });
  it('rejects pending requests and unapproved listings', async () => {
    db.swapRequest.findUnique.mockResolvedValue({ ...request, status: 'pending' });
    await expect(swapService.updateSwapRequestStatus('request', 'owner', 'user', 'completed')).rejects.toThrow('accepted exchange');
    db.swapRequest.findUnique.mockResolvedValue({ ...request, listing: { ...listing, approvalStatus: 'pending' } });
    await expect(swapService.updateSwapRequestStatus('request', 'owner', 'user', 'completed')).rejects.toThrow('accepted exchange');
    expect(db.$transaction).not.toHaveBeenCalled();
  });
  it('rejects unrelated users', async () => {
    await expect(swapService.updateSwapRequestStatus('request', 'stranger', 'user', 'completed')).rejects.toThrow('permission');
    expect(db.$transaction).not.toHaveBeenCalled();
  });
  it('does not award if another update wins', async () => {
    db.swapRequest.updateMany.mockResolvedValue({ count: 0 });
    await expect(swapService.updateSwapRequestStatus('request', 'owner', 'user', 'completed')).rejects.toThrow('changed');
    expect(db.userBadge.createMany).not.toHaveBeenCalled();
  });
});
