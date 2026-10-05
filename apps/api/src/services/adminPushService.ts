import webpush from 'web-push';
import { createHash } from 'node:crypto';
import { prisma } from '../prismaClient';
import { isQuietHour, notificationScope, validPushEndpoint } from './adminNotificationRules';
import type { TokenSession } from '../security/tokenService';

export async function recordAdminWorkerFailure(worker: string) {
  try {
    await prisma.$executeRaw`INSERT INTO admin_notification_events(event_key,category,title,message,record_type,record_id,audience,action_required)
      VALUES(${`worker:${worker}:${new Date().toISOString().slice(0,13)}`},'system','Scheduled processing needs attention',
        'A scheduled worker failed. Check server logs before retrying.','worker_failure',${worker},'admin',true) ON CONFLICT DO NOTHING`;
  } catch { console.error('admin_worker_alert_unavailable', worker); }
}
export async function resolveAdminWorkerFailure(worker: string) {
  await prisma.$executeRaw`UPDATE admin_notification_events SET resolved_at=CURRENT_TIMESTAMP
    WHERE record_type='worker_failure' AND record_id=${worker} AND resolved_at IS NULL`;
}

export async function createAdminReminders() {
  const hours = Number(process.env.ADMIN_REVIEW_REMINDER_HOURS ?? 24);
  const cutoff = new Date(Date.now() - (Number.isFinite(hours) && hours>=1 ? hours : 24)*3600000);
  await prisma.$executeRaw`INSERT INTO admin_notification_events(event_key,category,title,message,record_type,record_id,barangays,audience,action_required)
    SELECT 'reminder:local:' || category || ':' || b || ':' || (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Manila')::date,
      category,count(DISTINCT record_id)::text || ' records are waiting for review','Review requests have passed the reminder threshold.',
      'review_summary',category,ARRAY[b],'moderator',false
    FROM admin_notification_events,unnest(barangays) b WHERE action_required AND resolved_at IS NULL
      AND record_type NOT IN ('review_summary','delivery_failure','worker_failure') AND available_at<=${cutoff}
    GROUP BY category,b ON CONFLICT DO NOTHING`;
  await prisma.$executeRaw`INSERT INTO admin_notification_events(event_key,category,title,message,record_type,record_id,audience,action_required)
    SELECT 'reminder:admin:' || category || ':' || (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Manila')::date,
      category,count(DISTINCT record_id)::text || ' records are waiting across barangays','Review requests have passed the reminder threshold.',
      'review_summary',category,'admin',false
    FROM admin_notification_events WHERE action_required AND resolved_at IS NULL
      AND record_type NOT IN ('review_summary','delivery_failure','worker_failure') AND available_at<=${cutoff}
    GROUP BY category ON CONFLICT DO NOTHING`;
  await prisma.$executeRaw`UPDATE admin_notification_events summary SET resolved_at=CURRENT_TIMESTAMP
    WHERE summary.record_type='review_summary' AND summary.resolved_at IS NULL AND NOT EXISTS(
      SELECT 1 FROM admin_notification_events original WHERE original.category=summary.category AND original.action_required
        AND original.resolved_at IS NULL AND original.record_type NOT IN ('review_summary','delivery_failure','worker_failure')
        AND original.available_at<=${cutoff} AND (summary.audience='admin' OR original.barangays && summary.barangays))`;
  await prisma.$executeRaw`UPDATE admin_notification_events SET resolved_at=CURRENT_TIMESTAMP
    WHERE record_type='delivery_failure' AND resolved_at IS NULL AND NOT EXISTS(
      SELECT 1 FROM notification_deliveries WHERE state IN ('failed','uncertain') OR (state='pending' AND attempts>=3))
      AND NOT EXISTS(SELECT 1 FROM admin_push_deliveries WHERE state IN ('failed','uncertain') OR (state='pending' AND attempts>=3))`;
  await prisma.$executeRaw`INSERT INTO admin_notification_events(event_key,category,title,message,record_type,record_id,audience,available_at)
    SELECT 'challenge:ended:' || id,'challenge','Challenge ended',left(title,160),'challenge',id,'both',"endDate"
    FROM "Challenge" WHERE active AND "endDate"<=CURRENT_TIMESTAMP AND "endDate">CURRENT_TIMESTAMP-interval '1 day'
    ON CONFLICT DO NOTHING`;
}

type PushJob = { event_id: string; subscription_id: string; attempts: number };
type Destination = { subscription: webpush.PushSubscription; userId: string; role: TokenSession['role']; city: string | null;
  sessionVersion: number; boundVersion: number; status: string; pushCategories: string[] | null; quietStart: number | null; quietEnd: number | null };
export async function deliverAdminPush(job: PushJob) {
  const destinations = await prisma.$queryRaw<Destination[]>`SELECT s.subscription,s.user_id AS "userId",u.role,p.city,
    u.status,u."sessionVersion" AS "sessionVersion",s.session_version AS "boundVersion",prefs.push_categories AS "pushCategories",
    prefs.quiet_start AS "quietStart",prefs.quiet_end AS "quietEnd"
    FROM admin_push_subscriptions s JOIN users u ON u.id=s.user_id LEFT JOIN "Profile" p ON p."userId"=u.id
    LEFT JOIN admin_notification_preferences prefs ON prefs.user_id=u.id WHERE s.id=${job.subscription_id} AND s.expires_at>CURRENT_TIMESTAMP`;
  const dest = destinations[0];
  if (!dest || dest.status !== 'active' || dest.sessionVersion!==dest.boundVersion || !validPushEndpoint(dest.subscription.endpoint)) return 'cancelled';
  const scope = notificationScope(dest);
  const events = await prisma.$queryRaw<{ id: string; category: string; recordType: string }[]>`SELECT e.id,e.category,e.record_type AS "recordType"
    FROM admin_notification_events e WHERE e.id=${job.event_id} AND ${scope} AND e.resolved_at IS NULL AND e.available_at<=CURRENT_TIMESTAMP
      AND (e.record_type<>'event' OR EXISTS(SELECT 1 FROM "Event" event WHERE event.id=e.record_id
        AND event.start_datetime<CURRENT_TIMESTAMP+interval '1 day' AND event.end_datetime>CURRENT_TIMESTAMP))
      AND NOT EXISTS(SELECT 1 FROM admin_notification_reads r WHERE r.user_id=${dest.userId} AND r.event_id=e.id)`;
  const event = events[0];
  if (!event || !(dest.pushCategories ?? (dest.role==='admin' ? ['system'] : [])).includes(event.category)) return 'cancelled';
  if (isQuietHour(dest.quietStart,dest.quietEnd)) return 'deferred';
  try {
    await webpush.sendNotification(dest.subscription,JSON.stringify({
      title: 'ECOBUD admin update', body: 'An update needs your attention. Sign in to view details.',
      notificationId: event.id, tag: `ecobud-${event.category}`,
    }),{ vapidDetails: { subject: process.env.WEB_PUSH_SUBJECT!, publicKey: process.env.WEB_PUSH_PUBLIC_KEY!, privateKey: process.env.WEB_PUSH_PRIVATE_KEY! },
      timeout: 10000, TTL: 3600, topic: createHash('sha256').update(event.category).digest('base64url').slice(0,32) });
    return 'sent';
  } catch (error) {
    const status = (error as { statusCode?: number }).statusCode;
    if (status===404 || status===410) {
      await prisma.$executeRaw`DELETE FROM admin_push_subscriptions WHERE id=${job.subscription_id}`;
      return 'cancelled';
    }
    if (status===429 || (status && status>=500)) return 'pending';
    return status ? 'failed' : 'uncertain';
  }
}
let timer: NodeJS.Timeout | undefined; let running = false;
export async function adminNotificationTick() {
  if (running) return; running = true;
  try {
    await createAdminReminders();
    if (!process.env.WEB_PUSH_PUBLIC_KEY || !process.env.WEB_PUSH_PRIVATE_KEY || !process.env.WEB_PUSH_SUBJECT) return;
    await prisma.$executeRaw`INSERT INTO admin_push_deliveries(event_id,subscription_id)
      SELECT e.id,s.id FROM admin_notification_events e JOIN admin_push_subscriptions s ON s.created_at<=e.available_at
      JOIN users u ON u.id=s.user_id LEFT JOIN "Profile" p ON p."userId"=u.id
      LEFT JOIN admin_notification_preferences prefs ON prefs.user_id=u.id
      WHERE e.available_at<=CURRENT_TIMESTAMP AND e.available_at>CURRENT_TIMESTAMP-interval '1 day' AND e.resolved_at IS NULL
        AND (e.record_type IN ('review_summary','worker_failure','delivery_failure') OR (e.record_type='event' AND e.title IN ('Event schedule or location changed','Event withdrawn')
          AND EXISTS(SELECT 1 FROM "Event" event WHERE event.id=e.record_id AND event.start_datetime<CURRENT_TIMESTAMP+interval '1 day' AND event.end_datetime>CURRENT_TIMESTAMP)))
        AND u.status='active' AND s.session_version=u."sessionVersion" AND s.expires_at>CURRENT_TIMESTAMP
        AND e.category=ANY(coalesce(prefs.push_categories,CASE WHEN u.role='admin' THEN ARRAY['system'] ELSE '{}'::text[] END))
        AND ((u.role='admin' AND e.audience IN ('admin','both')) OR (u.role='moderator' AND e.audience IN ('moderator','both')
          AND nullif(trim(p.city),'') IS NOT NULL AND EXISTS(SELECT 1 FROM unnest(e.barangays) b WHERE lower(b)=lower(trim(p.city)))))
      ON CONFLICT DO NOTHING`;
    await prisma.$executeRaw`UPDATE admin_push_deliveries SET state='uncertain' WHERE state='sending' AND next_at<CURRENT_TIMESTAMP-interval '5 minutes'`;
    const jobs = await prisma.$queryRaw<PushJob[]>`UPDATE admin_push_deliveries SET state='sending',next_at=CURRENT_TIMESTAMP
      WHERE (event_id,subscription_id) IN (SELECT event_id,subscription_id FROM admin_push_deliveries
        WHERE state IN ('pending','deferred') AND attempts<5 AND next_at<=CURRENT_TIMESTAMP ORDER BY next_at LIMIT 20 FOR UPDATE SKIP LOCKED) RETURNING *`;
    for (let offset=0;offset<jobs.length;offset+=5) {
      await Promise.all(jobs.slice(offset,offset+5).map(async job => {
        let state: string;
        try { state = await deliverAdminPush(job); } catch { state='uncertain'; }
        await prisma.$executeRaw`UPDATE admin_push_deliveries SET state=${state},attempts=attempts+${state==='deferred' ? 0 : 1},
          next_at=${new Date(Date.now()+(state==='deferred' ? 900000 : Math.min(3600000,60000*2**job.attempts)))}
          WHERE event_id=${job.event_id} AND subscription_id=${job.subscription_id}`;
      }));
    }
  } catch { console.error('admin_notification_worker_failed'); }
  finally { running=false; }
}
export function startAdminNotificationWorker() { if (timer) return; void adminNotificationTick(); timer=setInterval(() => void adminNotificationTick(),60000); timer.unref(); }
export function stopAdminNotificationWorker() { if (timer) clearInterval(timer); timer=undefined; }
