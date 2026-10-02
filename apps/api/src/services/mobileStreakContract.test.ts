import { describe, expect, it } from 'vitest';
import { isStreakFlameActive, parseStreakSummary } from '../../../mobile/src/shared/api/streakSummary';

const response = () => ({ currentStreak: 3, active: true, restoresRemaining: 3, canRestore: false, lastChallengeAt: '2026-10-01T00:00:00Z', milestones: [{ challenges: 3, points: 30, ecoCoins: 0, badge: null, awarded: true }] });

describe('mobile streak contract', () => {
  it('accepts the current API summary', () => { expect(parseStreakSummary(response()).currentStreak).toBe(3); });
  it.each([null, undefined, { currentStreak: 3 }, { ...response(), milestones: undefined }, { ...response(), milestones: [null] }, { ...response(), milestones: [] }, { ...response(), milestones: [{ challenges: 3, points: '30' }] }])('rejects incomplete summaries without a render-time crash', value => {
    expect(() => parseStreakSummary(value)).toThrow('unavailable right now');
  });
  it.each([[0, true, false], [1, true, false], [2, true, false], [3, true, true], [100, true, true], [3, false, false]])('flame visibility at count %i and active=%s', (count, active, expected) => {
    expect(isStreakFlameActive(count, active)).toBe(expected);
  });
});
