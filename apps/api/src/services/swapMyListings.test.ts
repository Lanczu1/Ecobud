import { beforeEach, describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => ({ swapListing: { findMany: vi.fn(), findUnique: vi.fn(), update: vi.fn() } }));
vi.mock('../prismaClient', () => ({ prisma: db }));
vi.mock('./notificationService', () => ({ sendDirectNotification: vi.fn() }));
vi.mock('./supabaseStorageService', () => ({ supabaseStorageService: {} }));
import { swapService } from './swapService';

type Row = { id: string; userId: string; isActive: boolean; approvalStatus: string; reportReason: string | null };
let rows: Row[];
function matches(row: Row, where: Record<string, any>): boolean {
  return Object.entries(where).every(([key, value]) => key === 'OR'
    ? value.some((branch: Record<string, any>) => matches(row, branch))
    : row[key as keyof Row] === value);
}
beforeEach(() => {
  vi.clearAllMocks();
  rows = [
    { id: 'approved', userId: 'owner', isActive: true, approvalStatus: 'approved', reportReason: null },
    { id: 'pending', userId: 'owner', isActive: true, approvalStatus: 'pending', reportReason: null },
    { id: 'rejected', userId: 'owner', isActive: false, approvalStatus: 'rejected', reportReason: 'Please upload a clear item photo.' },
    { id: 'removed', userId: 'owner', isActive: false, approvalStatus: 'approved', reportReason: null },
    { id: 'other', userId: 'another-owner', isActive: false, approvalStatus: 'rejected', reportReason: 'Different resident.' },
  ];
  db.swapListing.findMany.mockImplementation(async ({ where }) => rows.filter(row => matches(row, where)));
  db.swapListing.findUnique.mockImplementation(async ({ where }) => rows.find(row => row.id === where.id));
  db.swapListing.update.mockImplementation(async ({ where, data }) => Object.assign(rows.find(row => row.id === where.id)!, data));
});

describe('resident listing history', () => {
  it('keeps inactive rejected listings with their real moderation reason alongside active listings', async () => {
    const result = await swapService.fetchMyListings('owner');
    expect(result.map(row => row.id)).toEqual(['approved', 'pending', 'rejected']);
    expect(result.find(row => row.id === 'rejected')).toMatchObject({ approvalStatus: 'rejected', isActive: false, rejectionReason: 'Please upload a clear item photo.' });
  });
  it('does not expose rejected or pending listings in the public feed', async () => {
    expect((await swapService.fetchListings({})).map(row => row.id)).toEqual(['approved']);
  });
  it('does not return another resident’s rejected listings', async () => {
    expect((await swapService.fetchMyListings('another-owner')).map(row => row.id)).toEqual(['other']);
  });
  it('keeps an explicitly deleted rejected listing out of My Listings', async () => {
    await swapService.deleteListing('rejected', 'owner', 'user');
    expect((await swapService.fetchMyListings('owner')).map(row => row.id)).toEqual(['approved', 'pending']);
  });
  it('preserves approval history when an approved listing is deleted', async () => {
    await swapService.deleteListing('approved', 'owner', 'user');
    expect(rows.find(row => row.id === 'approved')).toMatchObject({ approvalStatus: 'approved', isActive: false });
    expect((await swapService.fetchMyListings('owner')).map(row => row.id)).toEqual(['pending', 'rejected']);
  });
  it('does not let another resident remove a rejected listing', async () => {
    await expect(swapService.deleteListing('rejected', 'another-owner', 'user')).rejects.toThrow('permission');
    expect(db.swapListing.update).not.toHaveBeenCalled();
  });
});
