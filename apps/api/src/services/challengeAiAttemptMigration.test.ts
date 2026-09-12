import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { beforeAll, describe, expect, it } from 'vitest';

const db = new PGlite();

beforeAll(async () => {
  await db.exec(`
    CREATE ROLE anon;
    CREATE ROLE authenticated;
    CREATE ROLE ecobud_backend;
    CREATE TABLE users(id text PRIMARY KEY);
    CREATE TABLE "Challenge"(id text PRIMARY KEY);
  `);
  await db.exec(readFileSync('prisma/migrations/20260912170000_challenge_ai_attempt_limits/migration.sql', 'utf8'));
  await db.exec(`INSERT INTO users(id) VALUES ('alice'), ('bob'); INSERT INTO "Challenge"(id) VALUES ('card-a'), ('card-b');`);
});

const consume = (userId: string, challengeId: string) => db.query<{ attempts_used: number }>(`
  INSERT INTO challenge_ai_attempt_limits(user_id, challenge_id, attempts_used, reset_at)
  VALUES ($1, $2, 1, CURRENT_TIMESTAMP + INTERVAL '15 minutes')
  ON CONFLICT (user_id, challenge_id) DO UPDATE
  SET attempts_used = CASE WHEN challenge_ai_attempt_limits.reset_at <= CURRENT_TIMESTAMP THEN 1 ELSE challenge_ai_attempt_limits.attempts_used + 1 END,
      reset_at = CASE WHEN challenge_ai_attempt_limits.reset_at <= CURRENT_TIMESTAMP THEN CURRENT_TIMESTAMP + INTERVAL '15 minutes' ELSE challenge_ai_attempt_limits.reset_at END,
      updated_at = CURRENT_TIMESTAMP
  WHERE challenge_ai_attempt_limits.reset_at <= CURRENT_TIMESTAMP
     OR challenge_ai_attempt_limits.attempts_used < 3
  RETURNING attempts_used
`, [userId, challengeId]);

describe.sequential('challenge AI attempt migration', () => {
  it('adds a new isolated table without modifying existing tables', async () => {
    const tables = await db.query<{ table_name: string }>(`SELECT table_name FROM information_schema.tables WHERE table_schema='public'`);
    expect(tables.rows.map(row => row.table_name)).toEqual(expect.arrayContaining(['users', 'Challenge', 'challenge_ai_attempt_limits']));
  });

  it('persists three attempts and rejects a fourth inside the same window', async () => {
    expect((await consume('alice', 'card-a')).rows[0].attempts_used).toBe(1);
    expect((await consume('alice', 'card-a')).rows[0].attempts_used).toBe(2);
    expect((await consume('alice', 'card-a')).rows[0].attempts_used).toBe(3);
    expect((await consume('alice', 'card-a')).rows).toHaveLength(0);
  });

  it('keeps limits separate per account and challenge card', async () => {
    expect((await consume('alice', 'card-b')).rows[0].attempts_used).toBe(1);
    expect((await consume('bob', 'card-a')).rows[0].attempts_used).toBe(1);
  });
});
