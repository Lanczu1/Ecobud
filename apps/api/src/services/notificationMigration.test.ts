import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
const db = new PGlite();
const count = async (table: string) => Number((await db.query<{
    count: number;
}>(`SELECT count(*) FROM ${table}`)).rows[0].count);
beforeAll(async () => {
    await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated;
 CREATE TABLE users(id text PRIMARY KEY,status text,role text);
 CREATE TABLE lessons(id text PRIMARY KEY,title text,is_published boolean);
 CREATE TABLE "Challenge"(id text PRIMARY KEY,title text,active boolean,"startDate" timestamp,"endDate" timestamp);
 CREATE TABLE "Event"(id text PRIMARY KEY,title text);
 CREATE TABLE notifications(id text PRIMARY KEY,user_id text REFERENCES users(id),title text,message text,is_read boolean DEFAULT false,created_at timestamp DEFAULT CURRENT_TIMESTAMP);
 INSERT INTO lessons VALUES('old','Existing',true); INSERT INTO notifications VALUES('legacy',NULL,'Legacy','Keep me',false,now());`);
    await db.exec(readFileSync('prisma/migrations/20260908010000_notifications/migration.sql', 'utf8'));
}, 30000);
afterAll(() => db.close());
describe.sequential('notification migration in PostgreSQL', () => {
    it('preserves existing notifications and baselines old publications', async () => {
        expect(await count('notifications')).toBe(1);
        expect((await db.query<any>("SELECT completed FROM notification_events WHERE key='learning_published:old'")).rows[0].completed).toBe(true);
    });
    it('does not announce drafts; publish, edit and repeated publish produce one event', async () => {
        await db.exec("INSERT INTO lessons VALUES('new','Learning',false)");
        const before = await count('notification_events');
        await db.exec("UPDATE lessons SET title='Draft edited' WHERE id='new'");
        expect(await count('notification_events')).toBe(before);
        await db.exec("UPDATE lessons SET is_published=true WHERE id='new';UPDATE lessons SET title='Edited' WHERE id='new';UPDATE lessons SET is_published=false WHERE id='new';UPDATE lessons SET is_published=true WHERE id='new'");
        expect(await count('notification_events')).toBe(before + 1);
    });
    it('rolls publication back when its transaction fails', async () => {
        await db.exec('BEGIN');
        await db.exec("INSERT INTO lessons VALUES('rollback','Failed',true)");
        await db.exec('ROLLBACK');
        expect((await db.query("SELECT * FROM notification_events WHERE related_id='rollback'")).rows).toHaveLength(0);
    });
    it('queues future challenges only for their visibility time and ignores inactive challenges', async () => {
        await db.exec(`INSERT INTO "Challenge" VALUES('draft','Draft',false,NULL,NULL),('future','Future',true,now()+interval '1 day',now()+interval '2 days')`);
        expect((await db.query("SELECT * FROM notification_events WHERE related_id='draft'")).rows).toHaveLength(0);
        expect((await db.query<any>("SELECT available_at>now() AS future FROM notification_events WHERE related_id='future'")).rows[0].future).toBe(true);
    });
    it('supports event drafts and first publication only', async () => {
        await db.exec(`INSERT INTO "Event"(id,title,is_published) VALUES('event','Cleanup',false)`);
        expect((await db.query("SELECT * FROM notification_events WHERE related_id='event'")).rows).toHaveLength(0);
        await db.exec(`UPDATE "Event" SET is_published=true WHERE id='event';UPDATE "Event" SET title='Edited' WHERE id='event'`);
        expect((await db.query("SELECT * FROM notification_events WHERE related_id='event'")).rows).toHaveLength(1);
    });
    it('only creates welcome events for legitimately verified active new members', async () => {
        await db.exec("INSERT INTO users VALUES('unverified','active','user',NULL),('verified','active','user',now()),('admin','active','admin',now()),('pending','pending','user',NULL)");
        expect((await db.query("SELECT * FROM notification_events WHERE type='verification'")).rows).toHaveLength(1);
        await db.exec("UPDATE users SET status='active' WHERE id='pending'");
        expect((await db.query("SELECT * FROM notification_events WHERE type='verification'")).rows).toHaveLength(1);
    });
    it('enforces one record per event and user at the database level', async () => {
        await db.exec("INSERT INTO notifications(id,user_id,title,message,notification_key) VALUES('n1','verified','Hello','World','same')");
        await expect(db.exec("INSERT INTO notifications(id,user_id,title,message,notification_key) VALUES('n2','verified','Hello','World','same')")).rejects.toThrow(/unique/i);
        await db.exec("INSERT INTO notifications(id,user_id,title,message,notification_key) VALUES('n3','unverified','Hello','World','same')");
        await db.exec("INSERT INTO notification_deliveries(id,notification_id,channel,destination) VALUES('d1','n1','push','token')");
        await expect(db.exec("INSERT INTO notification_deliveries(id,notification_id,channel,destination) VALUES('d2','n1','push','token')")).rejects.toThrow(/unique/i);
    });
    it('denies direct client access to delivery destinations and publication jobs', async () => {
        await db.exec('SET ROLE authenticated');
        for (const table of ['notification_devices', 'notification_events', 'notification_deliveries'])
            await expect(db.query(`SELECT * FROM ${table}`)).rejects.toThrow(/permission denied/i);
        await db.exec('RESET ROLE');
    });
});
