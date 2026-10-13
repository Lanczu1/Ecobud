import { describe, expect, it, vi } from 'vitest';
import { PGlite } from '@electric-sql/pglite';

vi.mock('../prismaClient', () => ({ prisma: { $queryRaw: vi.fn() } }));

import { prisma } from '../prismaClient';
import { eventReportSummaryQuery, getEventReportSummaries } from './eventReportSummaries';

describe('event report summaries', () => {
  it('aggregates all requested events without multiplying counts or reading report details', async () => {
    const db = new PGlite();
    try {
      await db.exec(`
        CREATE TABLE "Event" (id text PRIMARY KEY, barangay text);
        CREATE TABLE "EventRegistration" ("eventId" text, "attendedAt" timestamp);
        CREATE TABLE event_submissions (event_id text, qr_verified boolean, status text);
        CREATE TABLE reward_transactions (event_id text, type text, amount integer);
        INSERT INTO "Event" VALUES ('one', 'Yukos'), ('empty', 'Yukos'), ('other', 'Banca-Banca');
        INSERT INTO "EventRegistration" VALUES ('one', NOW()), ('one', NULL), ('other', NOW());
        INSERT INTO event_submissions VALUES ('one', true, 'approved'), ('one', true, 'rejected'), ('one', false, 'pending');
        INSERT INTO reward_transactions VALUES ('one', 'eco_coins', 50), ('one', 'eco_coins', -5), ('one', 'exp', 20), ('one', 'exp', -10);
      `);
      const query = eventReportSummaryQuery(['one', 'empty', 'other'], null);
      const result = await db.query(query.text, query.values);
      const one = result.rows.find((row: any) => row.eventId === 'one');
      expect(one).toMatchObject({ totalRegistered: 2, attended: 1, qrVerified: 2, approved: 1, rejected: 1, pendingVerification: 1 });
      expect(Number((one as any).totalCoinsAwarded)).toBe(45);
      expect(Number((one as any).totalExpAwarded)).toBe(30);
      const empty = result.rows.find((row: any) => row.eventId === 'empty') as any;
      for (const [key, value] of Object.entries(empty)) if (key !== 'eventId') expect(Number(value)).toBe(0);
      const scoped = eventReportSummaryQuery(['one', 'empty', 'other'], 'Yukos');
      expect((await db.query(scoped.text, scoped.values)).rows.map((row: any) => row.eventId).sort()).toEqual(['empty', 'one']);
      const missing = eventReportSummaryQuery(['missing'], null);
      expect((await db.query(missing.text, missing.values)).rows).toEqual([]);
      expect((await db.query('SELECT COUNT(*)::int AS count FROM reward_transactions')).rows).toEqual([{ count: 4 }]);
    } finally { await db.close(); }
  }, 20000);

  it('uses one read query and returns JSON-safe numeric totals', async () => {
    vi.mocked(prisma.$queryRaw).mockResolvedValueOnce([{ eventId: 'one', totalRegistered: 2, attended: 1, qrVerified: 1, pendingVerification: 0, approved: 1, rejected: 0, totalCoinsAwarded: 50n, totalExpAwarded: 20n }]);
    const result = await getEventReportSummaries({ role: 'admin' }, ['one']);
    expect(result[0].stats.totalCoinsAwarded).toBe(50);
    expect(result[0].stats.totalExpAwarded).toBe(20);
    expect(() => JSON.stringify(result)).not.toThrow();
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
  });

  it('requires a valid moderator scope before querying', async () => {
    vi.mocked(prisma.$queryRaw).mockClear();
    await expect(getEventReportSummaries({ role: 'user' }, ['one'])).rejects.toMatchObject({ statusCode: 403 });
    await expect(getEventReportSummaries({ role: 'moderator', city: null }, ['one'])).rejects.toMatchObject({ statusCode: 403 });
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
  });
});
