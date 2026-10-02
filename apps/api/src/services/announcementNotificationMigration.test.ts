import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { activationSql } from '../../scripts/activate-announcement-push.cjs';

const db = new PGlite();
const events = async (id: string) => (await db.query<any>('SELECT * FROM notification_events WHERE related_id=$1', [id])).rows;
beforeAll(async () => {
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated;
    CREATE TABLE users(id text PRIMARY KEY,status text,role text);
    CREATE TABLE lessons(id text PRIMARY KEY,title text,is_published boolean);
    CREATE TABLE "Challenge"(id text PRIMARY KEY,title text,active boolean,"startDate" timestamp,"endDate" timestamp);
    CREATE TABLE "Event"(id text PRIMARY KEY,title text);
    CREATE TABLE notifications(id text PRIMARY KEY,user_id text REFERENCES users(id),title text,message text,is_read boolean DEFAULT false,created_at timestamp DEFAULT CURRENT_TIMESTAMP);`);
  await db.exec(readFileSync('prisma/migrations/20260908010000_notifications/migration.sql', 'utf8'));
  await db.exec(readFileSync('prisma/migrations/20261002000000_announcements/migration.sql', 'utf8'));
  await db.exec("INSERT INTO users(id,status,role) VALUES('author','active','admin')");
  await db.exec(`INSERT INTO announcements(id,title,content,category,status,"createdById","updatedAt") VALUES('old','Existing','Body','General','Published','author',now())`);
  await db.exec(`INSERT INTO announcements(id,title,content,category,status,"publishAt","createdById","updatedAt") VALUES('old-future','Future schedule','Body','General','Scheduled',now()+interval '1 day','author',now())`);
  await db.exec(readFileSync('prisma/migrations/20261002020000_announcement_notifications/migration.sql', 'utf8'));
}, 30000);
afterAll(() => db.close());

const insert = (id: string, status: string, publish = 'NULL') => db.exec(`INSERT INTO announcements(id,title,content,category,status,"publishAt","createdById","updatedAt") VALUES('${id}','Community update','Body','General','${status}',${publish},'author',now())`);
describe.sequential('announcement publication outbox', () => {
  it('installs dormant without changing business records or queuing pushes, then activates explicitly', async () => {
    const trigger = (await db.query<any>("SELECT tgenabled FROM pg_trigger WHERE tgname='notification_announcement'")).rows[0];
    expect(trigger.tgenabled).toBe('D');
    await insert('dormant', 'Published');
    expect(await events('dormant')).toHaveLength(0);
    expect((await db.query("SELECT * FROM notification_events WHERE type='announcement' AND NOT completed")).rows).toHaveLength(0);
    expect((await events('old-future'))[0].completed).toBe(true);
    await db.exec('BEGIN');
    for (const sql of activationSql) await db.exec(sql);
    await db.exec('COMMIT');
    expect((await events('old-future'))[0].completed).toBe(false);
    expect((await events('dormant'))[0].completed).toBe(true);
  });
  it('baselines existing publications without sending old announcements', async () => {
    expect((await events('old'))[0].completed).toBe(true);
  });
  it('publishes once and updates unsent copy without duplicating on edits', async () => {
    await insert('new', 'Draft');
    expect(await events('new')).toHaveLength(0);
    await db.exec("UPDATE announcements SET status='Published' WHERE id='new'");
    await db.exec("UPDATE announcements SET title='Updated title' WHERE id='new'");
    expect(await events('new')).toHaveLength(1);
    expect((await events('new'))[0]).toMatchObject({ type: 'announcement', message: 'Updated title', completed: false });
    await db.exec("UPDATE notification_events SET completed=true WHERE related_id='new'; UPDATE announcements SET status='Draft' WHERE id='new'; UPDATE announcements SET status='Published' WHERE id='new'");
    expect((await events('new'))[0].completed).toBe(true);
  });
  it('waits for the schedule and follows rescheduling', async () => {
    await insert('future', 'Scheduled', "now()+interval '1 day'");
    expect(new Date((await events('future'))[0].available_at).getTime()).toBeGreaterThan(Date.now());
    await db.exec(`UPDATE announcements SET "publishAt"=now()+interval '2 days' WHERE id='future'`);
    expect(new Date((await events('future'))[0].available_at).getTime()).toBeGreaterThan(Date.now()+86400000);
  });
  it('cancels unpublished schedules and permits first publication later', async () => {
    await insert('cancelled', 'Scheduled', "now()+interval '1 day'");
    await db.exec("UPDATE announcements SET status='Draft' WHERE id='cancelled'");
    expect(await events('cancelled')).toHaveLength(0);
    await db.exec("UPDATE announcements SET status='Published' WHERE id='cancelled'");
    expect(await events('cancelled')).toHaveLength(1);
  });
  it('does not queue already expired posts', async () => {
    await insert('expired', 'Draft');
    await db.exec(`UPDATE announcements SET status='Published',"expiresAt"=now()-interval '1 second' WHERE id='expired'`);
    expect(await events('expired')).toHaveLength(0);
  });
  it('commits the announcement and event atomically', async () => {
    await db.exec('BEGIN');
    await insert('rollback', 'Published');
    await db.exec('ROLLBACK');
    expect(await events('rollback')).toHaveLength(0);
  });
});

