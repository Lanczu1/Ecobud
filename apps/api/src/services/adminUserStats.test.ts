import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { Prisma, type PrismaClient } from '@prisma/client';
import { getAdminUserStats } from './adminUserStats';

const db = new PGlite();
const snapshot = new Date('2026-10-04T06:00:00Z');
const database = {
  $queryRaw: async (query: Prisma.Sql) => (await db.query(query.text, query.values)).rows,
} as Pick<PrismaClient, '$queryRaw'>;

beforeAll(async () => {
  await db.exec(`
    CREATE TABLE users(id text PRIMARY KEY, role text);
    CREATE TABLE presence_sessions(user_id text, is_online boolean, expires_at timestamptz);
    INSERT INTO users SELECT 'member-' || n, 'user' FROM generate_series(1, 27) n;
    INSERT INTO users VALUES ('admin-1', 'admin'), ('moderator-1', 'moderator');
    INSERT INTO presence_sessions VALUES
      ('member-21', true, '2026-10-04 06:01:00+00'),
      ('member-21', true, '2026-10-04 06:02:00+00'),
      ('member-22', true, '2026-10-04 05:59:00+00'),
      ('member-23', false, '2026-10-04 06:01:00+00'),
      ('member-24', true, '2026-10-04 06:00:00+00');
  `);
}, 20000);
afterAll(async () => db.close());

describe('global Users tab totals', () => {
  it('counts all members and online sessions beyond the first ten without double counting', async () => {
    expect(await getAdminUserStats(database, 'user', snapshot)).toEqual({ total: 27, online: 1, offline: 26 });
  });
  it('counts both staff roles independently of members', async () => {
    expect(await getAdminUserStats(database, 'staff', snapshot)).toEqual({ total: 2, online: 0, offline: 2 });
  });
});
