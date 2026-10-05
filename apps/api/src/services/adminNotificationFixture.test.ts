import { PGlite } from '@electric-sql/pglite';
import { notificationFixtureSql, adminNotificationMigration } from '../../tests/adminNotificationDb';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { notificationScope, isQuietHour, validPushEndpoint } from './adminNotificationRules';

const db=new PGlite();
const count=async (where='TRUE') => Number((await db.query<{ count: string }>(`SELECT count(*) FROM admin_notification_events WHERE ${where}`)).rows[0].count);
beforeAll(async () => { await db.exec(notificationFixtureSql); await db.exec(adminNotificationMigration); },30000);
afterAll(()=>db.close());
describe.sequential('admin notification migration and authorization',()=>{
  it('baselines pending queues and existing publications without duplicates on edit',async()=>{
    expect(await count()).toBe(2);
    await db.exec(`UPDATE lessons SET title='Edited existing lesson' WHERE id='legacy'`);
    expect(await count()).toBe(2);
  });
  it('records new requests atomically, preserves no ID data, and rolls back together',async()=>{
    await db.exec(`INSERT INTO id_verification_submissions VALUES('id-a','resident-a','Alibungbungan','pending',now());
      INSERT INTO id_verification_submissions VALUES('id-b','resident-b','Alumbrado','pending',now());`);
    expect(await count("record_type='id_verification'")).toBe(3);
    await db.exec(`BEGIN; INSERT INTO redeem_requests VALUES('rollback','resident-a','pending',now()); ROLLBACK;`);
    expect(await count("record_id='rollback'")).toBe(0);
    expect((await db.query<any>(`SELECT message FROM admin_notification_events WHERE record_id='id-a'`)).rows[0].message).not.toContain('resident-a');
  });
  it('fails closed for unassigned moderators and isolates both barangays using real SQL predicates',async()=>{
    const a=notificationScope({ role:'moderator',city:' Alibungbungan ' });
    const b=notificationScope({ role:'moderator',city:'Alumbrado' });
    const unassigned=notificationScope({ role:'moderator',city:null });
    const admin=notificationScope({ role:'admin' });
    expect((await db.query<any>(`SELECT e.record_id FROM admin_notification_events e WHERE ${a.text}`,a.values)).rows.map(r=>r.record_id).sort()).toEqual(['existing','id-a']);
    expect((await db.query<any>(`SELECT e.record_id FROM admin_notification_events e WHERE ${b.text}`,b.values)).rows.map(r=>r.record_id)).toEqual(['id-b']);
    expect((await db.query<any>(`SELECT e.id FROM admin_notification_events e WHERE ${unassigned.text}`,unassigned.values)).rows).toHaveLength(0);
    expect((await db.query<any>(`SELECT e.id FROM admin_notification_events e WHERE ${admin.text}`,admin.values)).rows).toHaveLength(4);
  });
  it('keeps read state independent from resolution and shares resolved status',async()=>{
    await db.exec(`INSERT INTO admin_notification_reads(user_id,event_id) SELECT 'mod-a',id FROM admin_notification_events WHERE record_id='id-a';`);
    expect(await count("record_id='id-a' AND resolved_at IS NULL")).toBe(1);
    await db.exec(`UPDATE id_verification_submissions SET status='approved' WHERE id='id-a'`);
    expect(await count("record_id='id-a' AND action_required AND resolved_at IS NULL")).toBe(0);
    expect(await count("record_id='id-a' AND NOT action_required")).toBe(1);
    await db.exec(`UPDATE id_verification_submissions SET status='approved' WHERE id='id-a'`);
    expect(await count("record_id='id-a'")).toBe(2);
  });
  it('records challenge final review, attendance, redemptions, listings and report resolution',async()=>{
    await db.exec(`INSERT INTO "ChallengeSubmission" VALUES('proof','resident-a','pending',now());
      UPDATE "ChallengeSubmission" SET status='final_review' WHERE id='proof';
      INSERT INTO event_submissions VALUES('attendance','resident-b','pending',now());
      INSERT INTO redeem_requests VALUES('reward','resident-a','pending',now());
      INSERT INTO swap_listings VALUES('listing','Alibungbungan','pending',now());
      INSERT INTO swap_listing_reports VALUES('report','listing',NULL,now());`);
    for (const id of ['proof','attendance','reward','listing','report']) expect(await count(`record_id='${id}' AND action_required`)).toBeGreaterThan(0);
    await db.exec(`UPDATE swap_listing_reports SET resolved_at=now() WHERE id='report'; DELETE FROM redeem_requests WHERE id='reward';`);
    expect(await count("record_id IN ('report','reward') AND action_required AND resolved_at IS NULL")).toBe(0);
  });
  it('does not publish drafts or future scheduled content early; edits do not repeat a publication',async()=>{
    await db.exec(`INSERT INTO lessons(id,title,is_published) VALUES('new','New lesson',false);`);
    expect(await count("record_id='new'")).toBe(0);
    await db.exec(`UPDATE lessons SET is_published=true WHERE id='new'; UPDATE lessons SET title='Edited' WHERE id='new';
      INSERT INTO announcements(id,title,status,"targetAudience",barangays,"publishAt") VALUES('future','Scheduled','Scheduled','Specific Barangay',ARRAY['Alumbrado'],now()+interval '2 days');`);
    expect(await count("record_id='new'")).toBe(1);
    expect(await count("record_id='future' AND available_at<=now()")).toBe(0);
    await db.exec(`UPDATE announcements SET status='Archived' WHERE id='future'`);
    expect(await count("record_id='future' AND resolved_at IS NULL")).toBe(0);
  });
  it('reopens resubmitted attendance/listings with a fresh unread alert and supersedes prior review stages',async()=>{
    await db.exec(`UPDATE event_submissions SET status='rejected' WHERE id='attendance';
      UPDATE event_submissions SET status='pending' WHERE id='attendance';
      UPDATE swap_listings SET approval_status='approved' WHERE id='listing';
      UPDATE swap_listings SET approval_status='pending' WHERE id='listing';`);
    for (const id of ['attendance','listing','proof']) expect(await count(`record_id='${id}' AND action_required AND resolved_at IS NULL`)).toBe(1);
    expect(await count("record_id='attendance' AND action_required")).toBe(2);
  });
  it('captures event changes and withdrawal, and groups delivery failures per hour',async()=>{
    await db.exec(`INSERT INTO "Event"(id,title,is_published,barangay,start_datetime,end_datetime,location) VALUES('event','Cleanup',true,'Alumbrado',now()+interval '1 hour',now()+interval '2 hours','Hall');
      UPDATE "Event" SET location='Park' WHERE id='event'; UPDATE "Event" SET is_published=false WHERE id='event';
      INSERT INTO notification_deliveries VALUES('d1','pending',0,'push'),('d2','pending',0,'push');
      UPDATE notification_deliveries SET state='failed';`);
    expect(await count("title='Event schedule or location changed'")).toBe(1);
    expect(await count("title='Event withdrawn'")).toBe(1);
    expect(await count("record_type='delivery_failure'")).toBe(1);
  });
  it('keeps every new table backend-only with RLS and revoked client grants',async()=>{
    for (const name of ['admin_notification_events','admin_notification_reads','admin_notification_preferences','admin_push_subscriptions','admin_push_deliveries']) {
      expect((await db.query<any>(`SELECT relrowsecurity FROM pg_class WHERE relname=$1`,[name])).rows[0].relrowsecurity).toBe(true);
      expect((await db.query<any>(`SELECT has_table_privilege('authenticated',$1,'SELECT') AS allowed`,[name])).rows[0].allowed).toBe(false);
    }
  });
});
describe('browser alert rules',()=>{
  it('handles daytime and overnight quiet hours in Philippine time',()=>{
    const night=new Date('2026-10-05T14:30:00Z');
    expect(isQuietHour(22,7,night)).toBe(true);
    expect(isQuietHour(9,17,night)).toBe(false);
    expect(isQuietHour(null,null,night)).toBe(false);
    expect(isQuietHour(7,7,night)).toBe(false);
    expect(isQuietHour(22,7,new Date('2026-10-04T23:00:00Z'))).toBe(false);
  });
  it('accepts supported HTTPS providers and rejects arbitrary destinations',()=>{
    expect(validPushEndpoint('https://fcm.googleapis.com/fcm/send/test')).toBe(true);
    expect(validPushEndpoint('https://updates.push.services.mozilla.com/wpush/v2/test')).toBe(true);
    for (const endpoint of ['http://fcm.googleapis.com/send','https://127.0.0.1/','https://fcm.googleapis.com.evil.example/','https://user:secret@fcm.googleapis.com/','https://fcm.googleapis.com:9999/']) expect(validPushEndpoint(endpoint)).toBe(false);
  });
});
