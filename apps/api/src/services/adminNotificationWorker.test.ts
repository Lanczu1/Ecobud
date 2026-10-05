import { PGlite } from '@electric-sql/pglite';
import { Prisma } from '@prisma/client';
import { beforeAll, afterAll, describe, it, expect, vi } from 'vitest';
import { notificationFixtureSql, adminNotificationMigration } from '../../tests/adminNotificationDb';
const store=vi.hoisted(()=>({ db:null as PGlite | null,send:vi.fn() }));
vi.mock('../prismaClient',()=>({ prisma:{
  $queryRaw:async (first:TemplateStringsArray | Prisma.Sql,...values:unknown[])=>{
    const q=Array.isArray(first) ? Prisma.sql(first as TemplateStringsArray,...values) : first as Prisma.Sql;
    return (await store.db!.query(q.text,q.values)).rows;
  },
  $executeRaw:async (first:TemplateStringsArray | Prisma.Sql,...values:unknown[])=>{
    const q=Array.isArray(first) ? Prisma.sql(first as TemplateStringsArray,...values) : first as Prisma.Sql;
    return (await store.db!.query(q.text,q.values)).affectedRows ?? 0;
  },
} }));
vi.mock('web-push',()=>({ default:{ sendNotification:store.send } }));
import { adminNotificationTick, createAdminReminders, deliverAdminPush } from './adminPushService';
beforeAll(async()=>{
  vi.stubEnv('WEB_PUSH_PUBLIC_KEY','test-key'); vi.stubEnv('WEB_PUSH_PRIVATE_KEY','test-private-key'); vi.stubEnv('WEB_PUSH_SUBJECT','mailto:fixture@example.invalid');
  store.send.mockResolvedValue({ statusCode:201 });
  store.db=new PGlite({ parsers:{ 1114:v=>new Date(`${v.replace(' ','T')}Z`) },serializers:{ 1114:v=>v instanceof Date ? v.toISOString().replace('Z','') : String(v) } });
  await store.db.exec(notificationFixtureSql); await store.db.exec(adminNotificationMigration);
  await store.db.exec(`UPDATE admin_notification_events SET available_at=now()-interval '2 days' WHERE record_id='existing';
    INSERT INTO id_verification_submissions(id,user_id,barangay,status,submitted_at) VALUES('old-b','resident-b','Alumbrado','pending',now()-interval '2 days');
    UPDATE admin_notification_events SET available_at=now()-interval '2 days' WHERE record_id='old-b';
    INSERT INTO admin_notification_preferences(user_id,push_categories) VALUES('admin',ARRAY['verification','system']),('mod-a',ARRAY['verification']),('mod-b',ARRAY['verification']);
    INSERT INTO admin_push_subscriptions(id,endpoint,subscription,user_id,session_version,created_at,expires_at)
      SELECT 'sub-'||id,'https://fcm.googleapis.com/fcm/send/'||id,jsonb_build_object('endpoint','https://fcm.googleapis.com/fcm/send/'||id,'keys',jsonb_build_object('p256dh','fixture','auth','fixture')),id,0,now()-interval '3 days',now()+interval '1 day'
      FROM users WHERE role IN ('admin','moderator');`);
},30000);
afterAll(async()=>{ vi.unstubAllEnvs(); await store.db?.close(); });
describe.sequential('durable grouped admin push worker',()=>{
  it('creates one reminder per local category and one consolidated admin reminder, without inflating pending counts',async()=>{
    await createAdminReminders(); await createAdminReminders();
    const summaries=(await store.db!.query<any>(`SELECT audience,barangays,action_required FROM admin_notification_events WHERE record_type='review_summary'`)).rows;
    expect(summaries).toHaveLength(3); expect(summaries.filter(row=>row.audience==='admin')).toHaveLength(1);
    expect(summaries.every(row=>!row.action_required)).toBe(true);
  });
  it('delivers summaries to the correct recipients once and does not push regular publications',async()=>{
    await adminNotificationTick(); await adminNotificationTick();
    expect(store.send).toHaveBeenCalledTimes(3);
    expect((await store.db!.query<any>(`SELECT state FROM admin_push_deliveries`)).rows.every(row=>row.state==='sent')).toBe(true);
    expect(store.send.mock.calls.map(call=>call[0].endpoint).sort()).toEqual(['admin','mod-a','mod-b'].map(id=>`https://fcm.googleapis.com/fcm/send/${id}`));
  });
  it('checks quiet hours before sending without spending retry attempts',async()=>{
    const hour=Number(new Intl.DateTimeFormat('en-US',{ timeZone:'Asia/Manila',hour:'numeric',hourCycle:'h23' }).format(new Date()));
    await store.db!.query(`UPDATE admin_notification_preferences SET quiet_start=$1,quiet_end=$2 WHERE user_id='mod-a'`,[hour,(hour+1)%24]);
    const event=(await store.db!.query<any>(`SELECT id FROM admin_notification_events WHERE record_type='review_summary' AND barangays=ARRAY['Alibungbungan']`)).rows[0];
    expect(await deliverAdminPush({ event_id:event.id,subscription_id:'sub-mod-a',attempts:0 })).toBe('deferred');
    expect(store.send).toHaveBeenCalledTimes(3);
  });
  it('rechecks reassigned barangays, expired subscriptions, and resolution',async()=>{
    const event=(await store.db!.query<any>(`SELECT id FROM admin_notification_events WHERE record_type='review_summary' AND barangays=ARRAY['Alibungbungan']`)).rows[0];
    await store.db!.exec(`UPDATE "Profile" SET city='Alumbrado' WHERE "userId"='mod-a'`);
    expect(await deliverAdminPush({ event_id:event.id,subscription_id:'sub-mod-a',attempts:0 })).toBe('cancelled');
    await store.db!.exec(`UPDATE admin_push_subscriptions SET expires_at=now()-interval '1 minute' WHERE id='sub-admin'`);
    const adminEvent=(await store.db!.query<any>(`SELECT id FROM admin_notification_events WHERE record_type='review_summary' AND audience='admin'`)).rows[0];
    expect(await deliverAdminPush({ event_id:adminEvent.id,subscription_id:'sub-admin',attempts:0 })).toBe('cancelled');
    await store.db!.exec(`UPDATE id_verification_submissions SET status='approved'`); await createAdminReminders();
    expect((await store.db!.query<any>(`SELECT id FROM admin_notification_events WHERE record_type='review_summary' AND resolved_at IS NULL`)).rows).toHaveLength(0);
  });
});
