import { describe, expect, it, vi } from 'vitest';
vi.mock('../prismaClient', () => ({ prisma: {} }));
import { selectChallengeSubmissionPage } from './challengeSubmissionPages';
import { latestSubmissionFirst, submissionActivityAt } from '../../../web/src/utils/submissionActivity';

const date = (day: number) => new Date(Date.UTC(2026, 9, day));

describe('latest challenge submission activity', () => {
  it('places an older submission with a new After photo above a newer Before photo', () => {
    const before = { id: 'new-before', createdAt: date(18).toISOString(), submittedAt: date(18).toISOString() };
    const after = { id: 'old-after', createdAt: date(10).toISOString(), submittedAt: date(19).toISOString() };
    expect([before, after].sort(latestSubmissionFirst).map(item => item.id)).toEqual(['old-after', 'new-before']);
    expect(after.createdAt).toBe(date(10).toISOString());
  });

  it('falls back to creation for older cached clients and resolves ties consistently', () => {
    const a = { id: 'a', createdAt: date(18).toISOString(), submittedAt: 'invalid' };
    const b = { id: 'b', createdAt: date(18).toISOString() };
    expect(submissionActivityAt(a)).toBe(a.createdAt);
    expect([a, b].sort(latestSubmissionFirst).map(item => item.id)).toEqual(['b', 'a']);
  });

  it.each([undefined, 'Yukos'])('paginates barangays by latest update before selecting records (%s scope)', async scope => {
    const query = vi.fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        { city: 'Old pending', total: 8, pending: 8, latest: date(1) },
        { city: 'Newest after photo', total: 1, pending: 0, latest: date(19) },
        { city: 'New before photo', total: 1, pending: 1, latest: date(18) },
        { city: 'Recent review', total: 1, pending: 0, latest: date(17) },
      ])
      .mockResolvedValueOnce([{ residents: 5 }])
      .mockResolvedValueOnce([{ id: 'visible' }]);
    const result = await selectChallengeSubmissionPage(scope, 1, { status: 'final_review' }, { $queryRaw: query });
    const selection = query.mock.calls[3][0];
    expect(selection.values).toEqual(expect.arrayContaining(['Newest after photo', 'New before photo', 'Recent review']));
    expect(selection.values).not.toContain('Old pending');
    expect(result.pagination.totalPages).toBe(2);
    expect(result.ids).toEqual(['visible']);
    expect(query.mock.calls[1][0].sql).toContain('MAX(m.submitted_at)');
    if (scope) expect(selection.values).toContain(scope);
  });
});
