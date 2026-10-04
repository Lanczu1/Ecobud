import { beforeEach, describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => ({ challengeSubmission: { findMany: vi.fn() } }));
vi.mock('../prismaClient', () => ({ prisma: db }));
import { selectChallengeSubmissionPage } from './challengeSubmissionPages';

function row(id: string, city: string | null, status = 'approved', userId = id) {
  return {
    id, userId, status, moderatorNotes: null,
    user: { name: userId, profile: { displayName: userId, city } },
    challengeInstance: { challenge: { title: 'Recycle bottles' } },
  };
}

describe('challenge submissions paginate by barangay', () => {
  beforeEach(() => vi.clearAllMocks());

  it('puts pending barangays first across pages and keeps a large barangay together', async () => {
    const large = Array.from({ length: 40 }, (_, index) => row(`p${index}`, 'Zeta', 'pending', 'residentZeta'));
    db.challengeSubmission.findMany.mockResolvedValue([
      row('a', 'Alpha'), row('b', 'Beta'), row('c', 'Gamma'), row('d', 'Delta', 'pending'), ...large,
    ]);
    const first = await selectChallengeSubmissionPage(undefined, 1, {});
    expect(first.ids).toEqual([...large.map(item => item.id), 'd', 'a']);
    expect(first.pagination).toEqual({ page: 1, pageSize: 3, total: 44, totalPages: 2, totalBarangays: 5, totalResidents: 5 });
    const second = await selectChallengeSubmissionPage(undefined, 2, {});
    expect(second.ids).toEqual(['b', 'c']);
    expect(second.ids.some(id => first.ids.includes(id))).toBe(false);
  });

  it('filters before paging, preserves dropdown options and clamps an empty or shortened page', async () => {
    db.challengeSubmission.findMany.mockResolvedValue([
      row('a', 'Alpha'), row('b', 'Beta', 'pending', 'Bea'), row('c', 'Gamma'), row('d', 'Delta'),
    ]);
    const filtered = await selectChallengeSubmissionPage(undefined, 2, { status: 'pending', search: 'bottles', userId: 'Bea' });
    expect(filtered.ids).toEqual(['b']);
    expect(filtered.pagination).toMatchObject({ page: 1, total: 1, totalPages: 1, totalResidents: 1 });
    expect(filtered.filterOptions.barangays).toHaveLength(4);
    const empty = await selectChallengeSubmissionPage(undefined, 3, { search: 'missing' });
    expect(empty.ids).toEqual([]);
    expect(empty.pagination).toMatchObject({ page: 1, total: 0, totalPages: 1 });
  });

  it('limits the source query to the authorized barangay without fetching proof images', async () => {
    db.challengeSubmission.findMany.mockResolvedValue([row('a', 'Yukos', 'pending')]);
    await selectChallengeSubmissionPage('Yukos', 1, {});
    const query = db.challengeSubmission.findMany.mock.calls[0][0];
    expect(query.where).toEqual({ user: { profile: { city: { equals: 'Yukos', mode: 'insensitive' } } } });
    expect(query.select.proofUrl).toBeUndefined();
    expect(query.select.afterProofUrl).toBeUndefined();
  });

  it('keeps unassigned profiles together when that barangay is selected', async () => {
    db.challengeSubmission.findMany.mockResolvedValue([
      row('a', null), row('b', '   ', 'pending'), row('c', 'Yukos'),
    ]);
    const result = await selectChallengeSubmissionPage('Unassigned Barangay', 1, {});
    expect(result.ids).toEqual(['a', 'b']);
    expect(result.pagination).toMatchObject({ total: 2, totalBarangays: 1 });
  });
});
