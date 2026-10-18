import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ challenge: vi.fn(), event: vi.fn(), lesson: vi.fn() }));
vi.mock('../prismaClient', () => ({
  prisma: { challenge: { findMany: mocks.challenge }, event: { findMany: mocks.event }, lesson: { findMany: mocks.lesson } },
}));

import { assertDestination, challengeProblem, eventProblem, findDestinations, lessonProblem } from './announcementDestinations';
import { announcementSchema, isHttpsUrl, storedActionValue } from './announcementRules';

const at = new Date('2026-10-20T00:00:00Z');
const challenge = { id: 'c1', title: 'Plastic drive', category: 'Waste', difficulty: 'Easy', active: true, startDate: null, endDate: null };
const event = { id: 'e1', title: 'River cleanup', barangay: 'Poblacion I', isPublished: true, startDatetime: at, endDatetime: at };
const lesson = { id: 'l1', title: 'Composting 101', category: 'Waste', isPublished: true, scheduledAt: null };
const everyone = { targetAudience: 'All Residents', barangays: [] };

describe('announcement destination access', () => {
  it('lets residents open an active challenge and explains why others cannot be opened', () => {
    expect(challengeProblem(challenge, at)).toBeNull();
    expect(challengeProblem({ ...challenge, active: false }, at)).toMatch(/turned off/);
    expect(challengeProblem({ ...challenge, endDate: new Date('2026-10-01T00:00:00Z') }, at)).toMatch(/ended/);
    expect(challengeProblem({ ...challenge, startDate: new Date('2026-11-01T00:00:00Z') }, at)).toMatch(/starts/);
  });

  it('only allows a barangay event when every targeted resident lives in that barangay', () => {
    expect(eventProblem({ ...event, barangay: null }, everyone)).toBeNull();
    expect(eventProblem(event, { targetAudience: 'Specific Barangay', barangays: ['poblacion i'] })).toBeNull();
    expect(eventProblem(event, everyone)).toMatch(/Only residents of Brgy\. Poblacion I/);
    expect(eventProblem(event, { targetAudience: 'Multiple Barangays', barangays: ['Poblacion I', 'Bucal'] })).toMatch(/Only residents/);
    expect(eventProblem({ ...event, barangay: null, isPublished: false }, everyone)).toMatch(/not published/);
  });

  it('accepts a learning module that is published or scheduled to publish by the time residents see the button', () => {
    expect(lessonProblem(lesson, at)).toBeNull();
    expect(lessonProblem({ ...lesson, isPublished: false, scheduledAt: new Date('2026-10-19T00:00:00Z') }, at)).toBeNull();
    expect(lessonProblem({ ...lesson, isPublished: false, scheduledAt: new Date('2026-10-25T00:00:00Z') }, at)).toMatch(/publishes on/);
    expect(lessonProblem({ ...lesson, isPublished: false }, at)).toMatch(/not published/);
  });

  it('searches by title and labels each match with its availability', async () => {
    mocks.event.mockResolvedValueOnce([event]);
    const items = await findDestinations('event', { search: 'river', audience: everyone, at });
    expect(mocks.event).toHaveBeenCalledWith(expect.objectContaining({ where: { title: { contains: 'river', mode: 'insensitive' } } }));
    expect(items).toEqual([expect.objectContaining({ id: 'e1', title: 'River cleanup', unavailableReason: expect.stringMatching(/Only residents/) })]);
  });

  it('refuses a deleted destination always, and an unopenable one only once residents will see it', async () => {
    mocks.challenge.mockResolvedValueOnce([]);
    await expect(assertDestination('challenge', 'gone', everyone, null)).rejects.toMatchObject({ statusCode: 400, message: expect.stringMatching(/no longer exists/) });
    mocks.challenge.mockResolvedValueOnce([{ ...challenge, active: false }]);
    await expect(assertDestination('challenge', 'c1', everyone, null)).resolves.toBeUndefined();
    mocks.challenge.mockResolvedValueOnce([{ ...challenge, active: false }]);
    await expect(assertDestination('challenge', 'c1', everyone, at)).rejects.toMatchObject({ message: expect.stringMatching(/^Plastic drive: .*turned off/) });
  });
});

describe('announcement action button validation', () => {
  const base = {
    title: 'Notice', content: 'Body', category: 'General', image: null, status: 'Draft', priority: 'Normal',
    targetAudience: 'All Residents', barangays: [], publishAt: null, expiresAt: null,
  };
  const parse = (action: { ctaType: string; ctaLabel: string | null; ctaValue: string | null }) => announcementSchema.safeParse({ ...base, ...action });

  it('keeps the button optional and requires a label for every action', () => {
    expect(parse({ ctaType: 'No Action', ctaLabel: null, ctaValue: null }).success).toBe(true);
    expect(parse({ ctaType: 'View Rewards', ctaLabel: null, ctaValue: null }).success).toBe(false);
  });

  it('opens rewards without a destination, and needs one for records and links', () => {
    expect(parse({ ctaType: 'View Rewards', ctaLabel: 'See rewards', ctaValue: null }).success).toBe(true);
    expect(parse({ ctaType: 'View Eco Event', ctaLabel: 'Join', ctaValue: null }).success).toBe(false);
    expect(parse({ ctaType: 'View Eco Event', ctaLabel: 'Join', ctaValue: 'e1' }).success).toBe(true);
  });

  it('accepts only absolute HTTPS links', () => {
    expect(isHttpsUrl('https://nagcarlan.gov.ph/news')).toBe(true);
    for (const bad of ['http://example.com', 'javascript:alert(1)', 'https://', '/relative', null]) expect(isHttpsUrl(bad)).toBe(false);
    expect(parse({ ctaType: 'Open External Link', ctaLabel: 'Read', ctaValue: 'http://example.com' }).success).toBe(false);
  });

  it('drops a value an older client sends with View Rewards and keeps record ids and links', () => {
    expect(storedActionValue('View Rewards', 'old-item-id')).toBeNull();
    expect(storedActionValue('View Eco Challenge', 'c1')).toBe('c1');
    expect(storedActionValue('Open External Link', 'https://example.com')).toBe('https://example.com');
  });
});
