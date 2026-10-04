import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { PGlite } from '@electric-sql/pglite';

const db = vi.hoisted(() => ({ $queryRaw: vi.fn() }));
vi.mock('../prismaClient', () => ({ prisma: db }));
import { getAdminUserActivity, parseActivityQuery } from './adminUserActivity';
import { adminUserActivityRoutes } from '../routes/adminUserActivityRoutes';
import { errorResponder } from '../http/errorResponder';

const pg = new PGlite();
const app = express();
app.use((req: any, _res, next) => { if (req.headers['x-role']) req.auth = { role: req.headers['x-role'] }; next(); });
app.use('/activity', adminUserActivityRoutes);
app.use(errorResponder);
const admin = { role: 'admin' };
const sources = [
  '"TransparencyLog"', 'reward_transactions', 'redeem_requests', '"UserChallenge"', '"ChallengeSubmission"',
  '"EventRegistration"', 'event_submissions', 'lesson_progress', '"HabitCheckIn"', '"UserBadge"',
  '"StreakMilestone"', 'swap_requests', 'swap_listings', 'audit_logs', 'users', '"Profile"', 'user_stats',
];
type RecordItem = { id: string; userId: string; barangay: string; points: number; coins: number; details: Record<string, unknown>; currentBalance: { points: number; coins: number }; source: string };
const read = async (query = {}) => await getAdminUserActivity(admin, query) as unknown as { items: RecordItem[]; pagination: { page: number; total: number; totalPages: number }; users: number };

beforeAll(async () => {
  await pg.exec(`
    CREATE TABLE users(id text PRIMARY KEY, role text, name text, email text, points int);
    CREATE TABLE "Profile"("userId" text PRIMARY KEY, "displayName" text, city text);
    CREATE TABLE user_stats(user_id text PRIMARY KEY, eco_coins int, knowledge_points int);
    CREATE TABLE "TransparencyLog"(id text PRIMARY KEY, "userId" text, "actionType" text, "pointsAwarded" int, metadata text, timestamp timestamp DEFAULT '2026-10-02 05:00:00');
    CREATE TABLE "Event"(id text PRIMARY KEY, title text);
    CREATE TABLE reward_transactions(id text PRIMARY KEY, user_id text, event_id text, type text, amount int, created_at timestamp DEFAULT '2026-10-02 05:00:00');
    CREATE TABLE redeem_requests(id text PRIMARY KEY, user_id text, item_title text, coin_cost int, status text, reject_reason text, created_at timestamp DEFAULT '2026-10-01 05:00:00', updated_at timestamp DEFAULT '2026-10-02 05:00:00');
    CREATE TABLE "Challenge"(id text PRIMARY KEY, title text);
    CREATE TABLE "ChallengeInstance"(id text PRIMARY KEY, "challengeId" text);
    CREATE TABLE "UserChallenge"(id text PRIMARY KEY, "userId" text, "challengeInstanceId" text, status text, "startedAt" timestamp DEFAULT '2026-10-02 05:00:00', "completedAt" timestamp);
    CREATE TABLE "ChallengeSubmission"(id text PRIMARY KEY, "userId" text, "challengeInstanceId" text, status text, "moderatorNotes" text, reviewed_at timestamp, reviewed_by_id text, reward_awarded boolean, created_at timestamp DEFAULT '2026-10-01 05:00:00', updated_at timestamp DEFAULT '2026-10-02 05:00:00');
    CREATE TABLE "EventRegistration"(id text PRIMARY KEY, "userId" text, "eventId" text, status text, "registeredAt" timestamp DEFAULT '2026-10-01 05:00:00', "attendedAt" timestamp);
    CREATE TABLE event_submissions(id text PRIMARY KEY, user_id text, event_id text, status text, rejection_reason text, submitted_at timestamp DEFAULT '2026-10-01 05:00:00', reviewed_at timestamp);
    CREATE TABLE lessons(id text PRIMARY KEY, title text);
    CREATE TABLE lesson_progress(id text PRIMARY KEY, user_id text, lesson_id text, status text, progress int, completed_at timestamp, updated_at timestamp DEFAULT '2026-10-02 05:00:00');
    CREATE TABLE "Habit"(id text PRIMARY KEY, title text);
    CREATE TABLE "HabitCheckIn"(id text PRIMARY KEY, "userId" text, "habitId" text, "dateKey" text, "createdAt" timestamp DEFAULT '2026-10-02 05:00:00');
    CREATE TABLE "Badge"(id text PRIMARY KEY, name text);
    CREATE TABLE "UserBadge"(id text PRIMARY KEY, "userId" text, "badgeId" text, "unlockedAt" timestamp DEFAULT '2026-10-02 05:00:00');
    CREATE TABLE "StreakMilestone"("userId" text, challenges int, "awardedAt" timestamp DEFAULT '2026-10-02 05:00:00');
    CREATE TABLE swap_listings(id text PRIMARY KEY, user_id text, title text, approval_status text, created_at timestamp DEFAULT '2026-10-01 05:00:00', updated_at timestamp DEFAULT '2026-10-02 05:00:00');
    CREATE TABLE swap_requests(id text PRIMARY KEY, listing_id text, from_user_id text, to_user_id text, status text, created_at timestamp DEFAULT '2026-10-01 05:00:00', updated_at timestamp DEFAULT '2026-10-02 05:00:00');
    CREATE TABLE audit_logs(id text PRIMARY KEY, "userId" text, action text, details text, timestamp timestamp DEFAULT '2026-10-02 05:00:00');
    INSERT INTO "Event" VALUES ('event','Clean-up');
    INSERT INTO "Challenge" VALUES ('challenge','Recycle');
    INSERT INTO "ChallengeInstance" VALUES ('instance','challenge');
    INSERT INTO lessons VALUES ('lesson','Reuse');
    INSERT INTO "Habit" VALUES ('habit','Reusable bag');
    INSERT INTO "Badge" VALUES ('badge','Eco Starter');
  `);
}, 20000);
afterAll(async () => { await pg.close(); });
beforeEach(async () => {
  vi.clearAllMocks();
  db.$queryRaw.mockImplementation(async sql => (await pg.query(sql.text, sql.values)).rows);
  await pg.exec(`TRUNCATE ${sources.join(',')};
    INSERT INTO users VALUES ('own','user','Ana','ana@example.test',250),('other','user','Ben','ben@example.test',10),('unknown','user','Cora','cora@example.test',0),('staff','moderator','Staff','staff@example.test',100);
    INSERT INTO "Profile" VALUES ('own','Ana Resident',' yukos '),('other',NULL,'Abo'),('unknown',NULL,'Unknown City'),('staff',NULL,'Yukos');
    INSERT INTO user_stats VALUES ('own',30,5);
    INSERT INTO "TransparencyLog"(id,"userId","actionType","pointsAwarded",metadata) VALUES
      ('claim','own','Challenge completed',20,'{"ecoCoinsAwarded":4,"challengeId":"challenge","claimToken":"secret"}'),
      ('other','other','Lesson completed',10,'{"ecoCoinsAwarded":2}'),
      ('unknown','unknown','Daily habit completed',2,'{}'),
      ('staff','staff','Challenge completed',10,'{}');
    INSERT INTO reward_transactions(id,user_id,type,amount) VALUES ('spend','own','eco_coins',-15),('refund','own','eco_coins',15),('bonus','own','exp',100);
    INSERT INTO reward_transactions(id,user_id,event_id,type,amount) VALUES ('event-credit','own','event','eco_coins',3);
    INSERT INTO redeem_requests(id,user_id,item_title,coin_cost,status) VALUES ('request','own','Reusable bottle',15,'claimed');
    INSERT INTO "UserChallenge"(id,"userId","challengeInstanceId",status) VALUES ('participation','own','instance','COMPLETED');
    INSERT INTO "ChallengeSubmission"(id,"userId","challengeInstanceId",status,"moderatorNotes",reward_awarded) VALUES ('proof','own','instance','approved','Verified',true);
    INSERT INTO "EventRegistration"(id,"userId","eventId",status,"attendedAt") VALUES ('registration','own','event','ATTENDED','2026-10-02 05:00:00');
    INSERT INTO event_submissions(id,user_id,event_id,status) VALUES ('event-proof','own','event','pending');
    INSERT INTO lesson_progress(id,user_id,lesson_id,status,progress) VALUES ('progress','own','lesson','completed',100);
    INSERT INTO "HabitCheckIn"(id,"userId","habitId","dateKey") VALUES ('check-in','own','habit','2026-10-02');
    INSERT INTO "UserBadge"(id,"userId","badgeId") VALUES ('award','own','badge');
    INSERT INTO "StreakMilestone"("userId",challenges) VALUES ('own',3);
    INSERT INTO swap_listings(id,user_id,title,approval_status) VALUES ('listing','own','Book','approved');
    INSERT INTO swap_requests(id,listing_id,from_user_id,to_user_id,status) VALUES ('exchange','listing','own','other','completed');
    INSERT INTO audit_logs(id,"userId",action,details) VALUES ('review','own','CHALLENGE_APPROVED','{"submissionId":"proof","reviewerId":"staff","password":"secret"}');
  `);
});

describe('admin user activity against PostgreSQL', () => {
  it('combines every supported source, both swap participants and canonical barangays', async () => {
    const result = await read();
    expect(result.pagination.total).toBe(21);
    expect(result.users).toBe(3);
    expect(new Set(result.items.map(item => item.source)).size).toBe(15);
    expect(result.items.filter(item => item.id.startsWith('swap:')).map(item => item.userId).sort()).toEqual(['other','own']);
    expect(result.items.find(item => item.id === 'activity:claim')).toMatchObject({ barangay: 'Yukos', points: 20, coins: 4, currentBalance: { points: 250, coins: 30 }, details: { ecoCoinsAwarded: 4, challengeId: 'challenge' } });
    expect(result.items.some(item => item.userId === 'staff')).toBe(false);
    expect(result.items.find(item => item.userId === 'unknown')?.barangay).toBe('Unassigned Barangay');
    expect(JSON.stringify(result)).not.toContain('secret');
  });
  it('includes debits, refunds and milestone credits with their original signed amounts', async () => {
    const result = await read({ source: 'Reward transaction' });
    expect(result.items.map(item => [item.id, item.points, item.coins])).toEqual([
      ['reward:spend',0,-15], ['reward:refund',0,15], ['reward:event-credit',0,3], ['reward:bonus',100,0],
    ]);
    expect((await read({ currency: 'coins' })).pagination.total).toBe(5);
    expect((await read({ category: 'redemptions' })).items[0]).toMatchObject({ id: 'redeem:request', points: 0, coins: 0, details: { coinCost: 15 } });
  });
  it('isolates barangays, residents, status and categories server-side', async () => {
    expect((await read({ barangay: 'Abo' })).items.map(item => item.userId)).toEqual(['other','other']);
    expect((await read({ barangay: 'unassigned' })).items.map(item => item.userId)).toEqual(['unknown']);
    expect((await read({ barangay: ' Yukos ', userId: 'other' })).items).toEqual([]);
    expect((await read({ category: 'challenges', status: 'approved' })).items.map(item => item.id)).toEqual(['challenge:proof']);
    expect((await read({ userId: 'own' })).users).toBe(1);
  });
  it('paginates tied timestamps without losing or repeating records, and clamps stale pages', async () => {
    const pages = await Promise.all([1,2,3,4,5].map(page => read({ page, pageSize: 5 })));
    const ids = pages.flatMap(page => page.items.map(item => item.id));
    expect(ids).toHaveLength(21);
    expect(new Set(ids).size).toBe(21);
    expect(pages.every(page => page.pagination.total === 21)).toBe(true);
    expect((await read({ page: 999, pageSize: 5 })).pagination.page).toBe(5);
  });
  it('treats through dates as inclusive in Philippine Time and handles SQL search literally', async () => {
    await pg.exec(`INSERT INTO "TransparencyLog"(id,"userId","actionType","pointsAwarded",timestamp) VALUES
      ('boundary-in','own','100%_reward',1,'2026-09-30 16:00:00'),('boundary-out','own','Outside',1,'2026-10-01 16:00:00');`);
    expect((await read({ source: 'Activity ledger', from: '2026-10-01', to: '2026-10-01' })).items.map(item => item.id)).toEqual(['activity:boundary-in']);
    expect((await read({ search: '100%_' })).items.map(item => item.id)).toEqual(['activity:boundary-in']);
    expect((await read({ search: "' OR 1=1 --" })).items).toEqual([]);
  });
  it('reads committed mobile/web updates and current balances on every uncached refresh', async () => {
    const first = await request(app).get('/activity?userId=own').set('x-role','admin').expect(200);
    expect(first.headers['cache-control']).toBe('no-store');
    await pg.exec(`BEGIN;
      INSERT INTO reward_transactions(id,user_id,type,amount) VALUES ('new-credit','own','eco_coins',7);
      UPDATE user_stats SET eco_coins=37 WHERE user_id='own';
      UPDATE redeem_requests SET status='rejected' WHERE id='request';
      COMMIT;`);
    const second = await request(app).get('/activity?userId=own').set('x-role','admin').expect(200);
    expect(second.body.pagination.total).toBe(first.body.pagination.total + 1);
    expect(second.body.items.find((item: RecordItem) => item.id === 'reward:new-credit').currentBalance.coins).toBe(37);
    expect(second.body.items.find((item: RecordItem) => item.id === 'redeem:request').status).toBe('rejected');
  });
  it('blocks moderators, users and missing authorization before querying the database', async () => {
    for (const role of ['moderator','user']) await request(app).get('/activity').set('x-role',role).expect(403);
    await request(app).get('/activity').expect(403);
    await expect(getAdminUserActivity({ role: 'moderator' }, {})).rejects.toThrow('admins only');
    expect(db.$queryRaw).not.toHaveBeenCalled();
  });
  it('rejects invalid dates, limits, repeated parameters and unrecognized filters', async () => {
    for (const query of [{ pageSize: 101 }, { page: 0 }, { from: '2026-02-30' }, { from: '2026-11-01', to: '2026-10-01' }, { barangay: ['Yukos','Abo'] }, { category: 'bad' }, { source: 'bad' }, { search: 'x'.repeat(121) }]) expect(() => parseActivityQuery(query)).toThrow();
    await request(app).get('/activity?pageSize=101').set('x-role','admin').expect(400);
    expect(db.$queryRaw).not.toHaveBeenCalled();
  });
});
