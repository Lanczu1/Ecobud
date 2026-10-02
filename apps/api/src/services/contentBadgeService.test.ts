import { describe, it, expect, vi } from 'vitest';
import { contentBadgeWrite, awardContentBadge } from './contentBadgeService';
const artwork = { enabled: true, name: 'Lesson Reward', description: 'Complete this lesson.', iconUrl: 'https://example.com/badge.png', accentColor: '#16A34A' };
describe('content badges', () => {
  it('leaves optional badges absent', () => {
    expect(contentBadgeWrite(undefined, 'lesson')).toBeUndefined();
    expect(contentBadgeWrite({ enabled: false }, 'lesson')).toBeUndefined();
  });
  it('creates with content and upserts the same relation on edit', () => {
    expect(contentBadgeWrite(JSON.stringify(artwork), 'lesson', true)).toMatchObject({ create: { name: artwork.name, awardType: 'lesson', active: true } });
    expect(contentBadgeWrite(artwork, 'lesson')).toMatchObject({ upsert: { create: { name: artwork.name }, update: { name: artwork.name } } });
  });
  it('disables future awards without deleting history', () => {
    expect(contentBadgeWrite({ ...artwork, enabled: false }, 'challenge')).toMatchObject({ upsert: { update: { active: false, awardType: 'challenge' } } });
  });
  it('rejects incomplete rewards and reserved names', () => {
    expect(() => contentBadgeWrite({ enabled: true }, 'lesson')).toThrow();
    expect(() => contentBadgeWrite({ ...artwork, name: 'Giveaway Master' }, 'lesson')).toThrow();
  });
  it.each(['lesson', 'challenge', 'event', 'exchange'])('awards only the active linked %s badge', async type => {
    const badge = { id: 'badge', ...artwork };
    const db = { badge: { findFirst: vi.fn(async () => badge) }, userBadge: { createMany: vi.fn(async () => ({ count: 1 })) } };
    const awards = await awardContentBadge(db as any, type, 'content', ['alice', 'bob', 'alice']);
    const field = { lesson: 'lessonId', challenge: 'challengeId', event: 'eventId', exchange: 'swapListingId' }[type]!;
    expect(db.badge.findFirst).toHaveBeenCalledWith({ where: { [field]: 'content', awardType: type, active: true } });
    expect(awards.map(item => item.userId)).toEqual(['alice', 'bob']);
    expect(db.userBadge.createMany).toHaveBeenCalledTimes(2);
  });
  it('does not re-award owned badges', async () => {
    const db = { badge: { findFirst: vi.fn(async () => ({ id: 'badge' })) }, userBadge: { createMany: vi.fn(async () => ({ count: 0 })) } };
    expect(await awardContentBadge(db as any, 'lesson', 'content', ['alice'])).toEqual([]);
  });
  it('does not award absent rewards', async () => {
    const db = { badge: { findFirst: vi.fn(async () => null) }, userBadge: { createMany: vi.fn() } };
    expect(await awardContentBadge(db as any, 'event', 'content', ['alice'])).toEqual([]);
    expect(db.userBadge.createMany).not.toHaveBeenCalled();
  });
});
