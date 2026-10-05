import { Router } from 'express';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../prismaClient';
import { authenticateRequest, requireModeratorAccess, type AuthenticatedRequest } from '../http/authentication';
import { errorBoundary, HttpError } from '../http/errorResponder';
import { adminNotificationCategories, notificationScope, validPushEndpoint } from '../services/adminNotificationRules';

export const adminNotificationRoutes = Router();
adminNotificationRoutes.use(authenticateRequest, requireModeratorAccess);
const preferences = z.object({
  pushCategories: z.array(z.enum(adminNotificationCategories)).max(8),
  quietStart: z.number().int().min(0).max(23).nullable(),
  quietEnd: z.number().int().min(0).max(23).nullable(),
}).refine(p => (p.quietStart === null) === (p.quietEnd === null), 'Set both quiet hours or leave both off.');
const baseScope = (req: AuthenticatedRequest) => Prisma.sql`${notificationScope(req.auth!)} AND e.available_at<=CURRENT_TIMESTAMP`;

adminNotificationRoutes.get('/preferences', errorBoundary(async (req: AuthenticatedRequest, res) => {
  const rows = await prisma.$queryRaw<{ pushCategories: string[]; quietStart: number | null; quietEnd: number | null }[]>`
    SELECT push_categories AS "pushCategories",quiet_start AS "quietStart",quiet_end AS "quietEnd"
    FROM admin_notification_preferences WHERE user_id=${req.auth!.userId}`;
  const key = process.env.WEB_PUSH_PUBLIC_KEY;
  res.json({ ...(rows[0] ?? { pushCategories: req.auth!.role === 'admin' ? ['system'] : [], quietStart: null, quietEnd: null }),
    publicKey: key && process.env.WEB_PUSH_PRIVATE_KEY && process.env.WEB_PUSH_SUBJECT ? key : null });
}));
adminNotificationRoutes.put('/preferences', errorBoundary(async (req: AuthenticatedRequest, res) => {
  const p = preferences.parse(req.body);
  const categories = [...new Set(p.pushCategories)].filter(c => req.auth!.role === 'admin' || !['system','learning'].includes(c));
  await prisma.$executeRaw`INSERT INTO admin_notification_preferences(user_id,push_categories,quiet_start,quiet_end)
    VALUES(${req.auth!.userId},${categories}::text[],${p.quietStart},${p.quietEnd})
    ON CONFLICT(user_id) DO UPDATE SET push_categories=EXCLUDED.push_categories,quiet_start=EXCLUDED.quiet_start,quiet_end=EXCLUDED.quiet_end`;
  res.json({ success: true });
}));
adminNotificationRoutes.post('/subscriptions', errorBoundary(async (req: AuthenticatedRequest, res) => {
  if (!process.env.WEB_PUSH_PUBLIC_KEY || !process.env.WEB_PUSH_PRIVATE_KEY || !process.env.WEB_PUSH_SUBJECT) throw new HttpError(503, 'Browser push is not configured yet.');
  const subscription = z.object({ endpoint: z.string().max(4096).refine(validPushEndpoint, 'Unsupported push provider.'),
    keys: z.object({ p256dh: z.string().regex(/^[A-Za-z0-9_-]+={0,2}$/).min(80).max(100), auth: z.string().regex(/^[A-Za-z0-9_-]+={0,2}$/).min(20).max(30) }) }).parse(req.body);
  const expiresAt=new Date(((req.auth!.authTime ?? Math.floor(Date.now()/1000))+12*3600)*1000);
  if (expiresAt<=new Date()) throw new HttpError(401,'Please sign in again to enable browser alerts.');
  await prisma.$executeRaw`INSERT INTO admin_push_subscriptions(endpoint,subscription,user_id,session_version,expires_at)
    VALUES(${subscription.endpoint},${JSON.stringify(subscription)}::jsonb,${req.auth!.userId},${req.auth!.sessionVersion ?? 0},${expiresAt})
    ON CONFLICT(endpoint) DO UPDATE SET subscription=EXCLUDED.subscription,user_id=EXCLUDED.user_id,session_version=EXCLUDED.session_version,expires_at=EXCLUDED.expires_at,created_at=CURRENT_TIMESTAMP`;
  res.json({ success: true });
}));
adminNotificationRoutes.delete('/subscriptions', errorBoundary(async (req: AuthenticatedRequest, res) => {
  const { endpoint } = z.object({ endpoint: z.string().max(4096) }).parse(req.body);
  await prisma.$executeRaw`DELETE FROM admin_push_subscriptions WHERE endpoint=${endpoint} AND user_id=${req.auth!.userId}`;
  res.json({ success: true });
}));
adminNotificationRoutes.delete('/subscriptions/session', errorBoundary(async (req: AuthenticatedRequest, res) => {
  await prisma.$executeRaw`DELETE FROM admin_push_subscriptions WHERE user_id=${req.auth!.userId} AND session_version=${req.auth!.sessionVersion ?? 0}`;
  res.json({ success: true });
}));
adminNotificationRoutes.get('/', errorBoundary(async (req: AuthenticatedRequest, res) => {
  const q = z.object({ category: z.enum(adminNotificationCategories).optional(), filter: z.enum(['all','unread','action']).default('all'),
    before: z.string().datetime().optional(), beforeId: z.string().max(100).optional() }).parse(req.query);
  const scope = baseScope(req);
  const filter = Prisma.sql`${scope}
    ${q.category ? Prisma.sql`AND e.category=${q.category}` : Prisma.empty}
    ${q.filter === 'unread' ? Prisma.sql`AND r.event_id IS NULL` : Prisma.empty}
    ${q.filter === 'action' ? Prisma.sql`AND e.action_required AND e.resolved_at IS NULL` : Prisma.empty}
    ${q.before && q.beforeId ? Prisma.sql`AND (e.available_at,e.id)<((${q.before}::text)::timestamp,${q.beforeId})` : Prisma.empty}`;
  const [items, counts] = await Promise.all([
    prisma.$queryRaw<Record<string, unknown>[]>`SELECT e.id,e.category,e.title,e.message,e.record_type AS "recordType",e.record_id AS "recordId",e.barangays,
      e.action_required AS "actionRequired",e.resolved_at AS "resolvedAt",e.available_at AS "createdAt",(r.event_id IS NOT NULL) AS "isRead"
      FROM admin_notification_events e LEFT JOIN admin_notification_reads r ON r.event_id=e.id AND r.user_id=${req.auth!.userId}
      WHERE ${filter} ORDER BY e.available_at DESC,e.id DESC LIMIT 31`,
    prisma.$queryRaw<{ unreadCount: bigint; actionCount: bigint }[]>`SELECT count(*) FILTER(WHERE r.event_id IS NULL) AS "unreadCount",
      count(*) FILTER(WHERE e.action_required AND e.resolved_at IS NULL) AS "actionCount"
      FROM admin_notification_events e LEFT JOIN admin_notification_reads r ON r.event_id=e.id AND r.user_id=${req.auth!.userId} WHERE ${scope}`,
  ]);
  const visible = items.slice(0,30); const last = visible.at(-1);
  res.json({ items: visible, unreadCount: Number(counts[0]?.unreadCount ?? 0), actionCount: Number(counts[0]?.actionCount ?? 0),
    next: items.length>30 && last ? { before: last.createdAt, beforeId: last.id } : null });
}));
adminNotificationRoutes.patch('/read-all', errorBoundary(async (req: AuthenticatedRequest, res) => {
  await prisma.$executeRaw`INSERT INTO admin_notification_reads(user_id,event_id)
    SELECT ${req.auth!.userId},e.id FROM admin_notification_events e WHERE ${baseScope(req)} ON CONFLICT DO NOTHING`;
  res.json({ success: true });
}));
adminNotificationRoutes.patch('/:id/read', errorBoundary(async (req: AuthenticatedRequest, res) => {
  const count = await prisma.$executeRaw`INSERT INTO admin_notification_reads(user_id,event_id)
    SELECT ${req.auth!.userId},e.id FROM admin_notification_events e WHERE e.id=${req.params.id} AND ${baseScope(req)}
    ON CONFLICT(user_id,event_id) DO UPDATE SET read_at=CURRENT_TIMESTAMP`;
  if (!count) throw new HttpError(404, 'Notification not found.');
  res.json({ success: true });
}));
adminNotificationRoutes.get('/:id', errorBoundary(async (req: AuthenticatedRequest, res) => {
  const rows = await prisma.$queryRaw<Record<string, unknown>[]>`SELECT e.id,e.category,e.title,e.message,e.record_type AS "recordType",e.record_id AS "recordId",e.barangays,
    e.action_required AS "actionRequired",e.resolved_at AS "resolvedAt",e.available_at AS "createdAt",(r.event_id IS NOT NULL) AS "isRead"
    FROM admin_notification_events e LEFT JOIN admin_notification_reads r ON r.event_id=e.id AND r.user_id=${req.auth!.userId}
    WHERE e.id=${req.params.id} AND ${baseScope(req)}`;
  if (!rows[0]) throw new HttpError(404,'Notification is unavailable or outside your assigned barangay.');
  let targetRecordId=rows[0].recordId;
  if (rows[0].recordType==='listing_report') {
    const report=await prisma.swapListingReport.findUnique({ where:{ id:String(rows[0].recordId) },select:{ listingId:true } });
    targetRecordId=report?.listingId ?? null;
  }
  let diagnostics: unknown[] = [];
  if (req.auth!.role === 'admin' && rows[0].recordType === 'delivery_failure') {
    diagnostics = await prisma.$queryRaw`SELECT channel,state,count(*)::integer AS count FROM (
      SELECT channel,state FROM notification_deliveries WHERE state IN ('failed','uncertain') OR (state='pending' AND attempts>=3)
      UNION ALL SELECT 'browser_push' AS channel,state FROM admin_push_deliveries WHERE state IN ('failed','uncertain') OR (state='pending' AND attempts>=3)
    ) failures GROUP BY channel,state`;
  }
  res.json({ ...rows[0], targetRecordId, diagnostics });
}));
