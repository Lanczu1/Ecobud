import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const db = new PGlite();
beforeAll(async () => {
  await db.exec(`
    CREATE ROLE anon; CREATE ROLE authenticated;
    CREATE TABLE users(id TEXT PRIMARY KEY, name TEXT);
    CREATE TABLE swap_listings(id TEXT PRIMARY KEY, is_reported BOOLEAN, report_count INTEGER, report_reason TEXT, updated_at TIMESTAMP);
    INSERT INTO users VALUES ('alice', 'Alice'), ('bob', 'Bob');
    INSERT INTO swap_listings VALUES ('legacy', TRUE, 3, 'Saved legacy reason', CURRENT_TIMESTAMP), ('new', FALSE, 0, NULL, CURRENT_TIMESTAMP);
  `);
  await db.exec(readFileSync('prisma/migrations/20261003130000_swap_listing_reports/migration.sql', 'utf8'));
}, 30000);
afterAll(() => db.close());

describe.sequential('Give and Get report storage', () => {
  it('preserves legacy report totals and reasons without changing accounts or listings', async () => {
    const legacy = (await db.query<any>("SELECT * FROM swap_listing_reports WHERE listing_id='legacy'")).rows;
    expect(legacy).toHaveLength(1);
    expect(legacy[0]).toMatchObject({ reporter_id: null, report_name: 'Earlier report', occurrences: 3, reason: 'Saved legacy reason' });
    expect((await db.query('SELECT * FROM users ORDER BY id')).rows).toEqual([{ id: 'alice', name: 'Alice' }, { id: 'bob', name: 'Bob' }]);
    expect((await db.query<any>("SELECT report_count, report_reason FROM swap_listings WHERE id='legacy'")).rows[0]).toEqual({ report_count: 3, report_reason: 'Saved legacy reason' });
  });
  it('allows different accounts while preventing duplicate active reports from one account', async () => {
    await db.exec("INSERT INTO swap_listing_reports(id,listing_id,reporter_id,report_name,reason) VALUES ('a','new','alice','Fake Listing','Fake item'), ('b','new','bob','Misleading Photos','Copied photos')");
    await expect(db.exec("INSERT INTO swap_listing_reports(id,listing_id,reporter_id,report_name,reason) VALUES ('duplicate','new','alice','Other','Again')")).rejects.toThrow();
    expect((await db.query("SELECT id FROM swap_listing_reports WHERE listing_id='new'")).rows).toHaveLength(2);
  });
  it('keeps resolved history and permits a new report after review', async () => {
    await db.exec("UPDATE swap_listing_reports SET resolved_at=CURRENT_TIMESTAMP WHERE listing_id='new'; INSERT INTO swap_listing_reports(id,listing_id,reporter_id,report_name,reason) VALUES ('after-review','new','alice','Other','New issue')");
    expect((await db.query("SELECT id FROM swap_listing_reports WHERE listing_id='new'")).rows).toHaveLength(3);
    expect((await db.query("SELECT id FROM swap_listing_reports WHERE listing_id='new' AND resolved_at IS NULL")).rows).toHaveLength(1);
  });
  it('does not expose reporter records to direct resident database access', async () => {
    for (const role of ['anon', 'authenticated']) {
      await db.exec(`SET ROLE ${role}`);
      try { await expect(db.query('SELECT * FROM swap_listing_reports')).rejects.toThrow(); }
      finally { await db.exec('RESET ROLE'); }
    }
  });
});
