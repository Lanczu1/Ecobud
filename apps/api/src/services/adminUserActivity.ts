import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../prismaClient';
import { HttpError } from '../http/errorResponder';
import { BARANGAYS } from '../utils/announcementBarangays';

export const activityCategories = ['all', 'rewards', 'redemptions', 'challenges', 'events', 'learning', 'habits', 'badges', 'streaks', 'swaps', 'listings', 'administration'] as const;
const querySchema = z.object({
  page: z.coerce.number().int().min(1).max(100000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
  search: z.string().trim().max(120).default(''),
  barangay: z.string().max(100).default('all'),
  userId: z.string().max(100).optional(),
  category: z.enum(activityCategories).default('all'),
  status: z.string().max(50).default('all'),
  currency: z.enum(['all', 'points', 'coins']).default('all'),
  source: z.enum(['all', 'Activity ledger', 'Reward transaction']).default('all'),
  from: z.string().optional(), to: z.string().optional(),
});

function localDate(value: string | undefined, end = false) {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00+08:00`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(date.getTime()) || new Date(date.getTime() + 8 * 3600000).toISOString().slice(0, 10) !== value) {
    throw new HttpError(400, 'Choose a valid date.');
  }
  return new Date(date.getTime() + (end ? 86400000 : 0));
}

export function parseActivityQuery(query: unknown) {
  const parsed = querySchema.safeParse(query);
  if (!parsed.success) throw new HttpError(400, 'Choose valid activity filters.');
  const filters = parsed.data;
  const canonical = BARANGAYS.find(name => name.toLowerCase() === filters.barangay.trim().toLowerCase());
  if (!canonical && !['all', 'unassigned'].includes(filters.barangay)) throw new HttpError(400, 'Choose a valid barangay.');
  const start = localDate(filters.from), end = localDate(filters.to, true);
  if (start && end && start >= end) throw new HttpError(400, 'The start date must be before the end date.');
  return { ...filters, barangay: canonical ?? filters.barangay, start, end };
}

export function activityQuery(filters: ReturnType<typeof parseActivityQuery>) {
  const search = `%${filters.search.replace(/[\\%_]/g, '\\$&')}%`;
  const scope = Prisma.sql`
    u.role = 'user'
    ${filters.barangay === 'all' ? Prisma.empty : filters.barangay === 'unassigned'
      ? Prisma.sql`AND (p.city IS NULL OR BTRIM(p.city) = '' OR LOWER(BTRIM(p.city)) NOT IN (${Prisma.join(BARANGAYS.map(name => name.toLowerCase()))}))`
      : Prisma.sql`AND LOWER(BTRIM(p.city)) = LOWER(${filters.barangay})`}
    ${filters.userId ? Prisma.sql`AND u.id = ${filters.userId}` : Prisma.empty}`;
  return Prisma.sql`
    WITH residents AS (
      SELECT u.id, COALESCE(NULLIF(p."displayName", ''), u.name) AS name, u.email,
        COALESCE((SELECT city FROM (VALUES ${Prisma.join(BARANGAYS.map(name => Prisma.sql`(${name})`))}) AS canonical(city)
          WHERE LOWER(city) = LOWER(BTRIM(p.city))), 'Unassigned Barangay') AS barangay,
        u.points, COALESCE(s.eco_coins, 0) AS coins, COALESCE(s.knowledge_points, 0) AS knowledge
      FROM users u LEFT JOIN "Profile" p ON p."userId" = u.id LEFT JOIN user_stats s ON s.user_id = u.id WHERE ${scope}
    ), records AS (
      SELECT 'activity:' || t.id AS id, t.id AS reference, t."userId" AS "userId", 'Activity ledger' AS source,
        CASE WHEN t."actionType" ILIKE 'Lesson%' THEN 'learning' WHEN t."actionType" ILIKE 'Challenge%' THEN 'challenges'
          WHEN t."actionType" ILIKE 'Event%' THEN 'events' WHEN t."actionType" ILIKE 'Daily habit%' THEN 'habits' ELSE 'rewards' END AS category,
        t."actionType" AS title, 'completed' AS status, t."pointsAwarded"::bigint AS points,
        COALESCE(SUBSTRING(t.metadata FROM '"ecoCoinsAwarded"[[:space:]]*:[[:space:]]*(-?[0-9]{1,10})')::bigint, 0) AS coins,
        t.timestamp AS at, t.metadata AS details FROM "TransparencyLog" t JOIN residents u ON u.id = t."userId"
      UNION ALL
      SELECT 'reward:' || t.id, t.id, t.user_id, 'Reward transaction', 'rewards',
        COALESCE('Event reward: ' || e.title, CASE WHEN t.amount < 0 THEN 'EcoCoins spent' ELSE 'Reward credit / refund' END),
        'completed', CASE WHEN t.type = 'exp' THEN t.amount ELSE 0 END, CASE WHEN t.type = 'eco_coins' THEN t.amount ELSE 0 END,
        t.created_at, json_build_object('eventId', t.event_id, 'currency', t.type)::text
        FROM reward_transactions t JOIN residents u ON u.id = t.user_id LEFT JOIN "Event" e ON e.id = t.event_id
      UNION ALL
      SELECT 'redeem:' || t.id, t.id, t.user_id, 'Redemption request', 'redemptions', 'Redeem: ' || t.item_title,
        t.status, 0, 0, t.updated_at, json_build_object('coinCost', t.coin_cost, 'requestedAt', t.created_at, 'reason', t.reject_reason)::text
        FROM redeem_requests t JOIN residents u ON u.id = t.user_id
      UNION ALL
      SELECT 'participation:' || t.id, t.id, t."userId", 'Challenge participation', 'challenges', 'Started: ' || c.title,
        t.status, 0, 0, t."startedAt", json_build_object('completedAt', t."completedAt")::text
        FROM "UserChallenge" t JOIN residents u ON u.id = t."userId" JOIN "ChallengeInstance" i ON i.id = t."challengeInstanceId" JOIN "Challenge" c ON c.id = i."challengeId"
      UNION ALL
      SELECT 'challenge:' || t.id, t.id, t."userId", 'Challenge submission', 'challenges', c.title,
        t.status::text, 0, 0, t.updated_at, json_build_object('submittedAt', t.created_at, 'reviewedAt', t.reviewed_at, 'reviewerId', t.reviewed_by_id, 'notes', t."moderatorNotes", 'rewardClaimed', t.reward_awarded)::text
        FROM "ChallengeSubmission" t JOIN residents u ON u.id = t."userId" JOIN "ChallengeInstance" i ON i.id = t."challengeInstanceId" JOIN "Challenge" c ON c.id = i."challengeId"
      UNION ALL
      SELECT 'registration:' || t.id, t.id, t."userId", 'Event registration', 'events', 'Registered: ' || e.title,
        t.status, 0, 0, t."registeredAt", NULL FROM "EventRegistration" t JOIN residents u ON u.id = t."userId" JOIN "Event" e ON e.id = t."eventId"
      UNION ALL
      SELECT 'attendance:' || t.id, t.id, t."userId", 'Event attendance', 'events', 'Attended: ' || e.title,
        'completed', 0, 0, t."attendedAt", NULL FROM "EventRegistration" t JOIN residents u ON u.id = t."userId" JOIN "Event" e ON e.id = t."eventId" WHERE t."attendedAt" IS NOT NULL
      UNION ALL
      SELECT 'event-proof:' || t.id, t.id, t.user_id, 'Event submission', 'events', e.title,
        t.status::text, 0, 0, COALESCE(t.reviewed_at, t.submitted_at), json_build_object('submittedAt', t.submitted_at, 'reason', t.rejection_reason)::text
        FROM event_submissions t JOIN residents u ON u.id = t.user_id JOIN "Event" e ON e.id = t.event_id
      UNION ALL
      SELECT 'lesson:' || t.id, t.id, t.user_id, 'Lesson progress', 'learning', l.title,
        t.status, 0, 0, t.updated_at, json_build_object('progress', t.progress, 'completedAt', t.completed_at)::text
        FROM lesson_progress t JOIN residents u ON u.id = t.user_id JOIN lessons l ON l.id = t.lesson_id
      UNION ALL
      SELECT 'habit:' || t.id, t.id, t."userId", 'Habit check-in', 'habits', h.title,
        'completed', 0, 0, t."createdAt", json_build_object('date', t."dateKey")::text
        FROM "HabitCheckIn" t JOIN residents u ON u.id = t."userId" JOIN "Habit" h ON h.id = t."habitId"
      UNION ALL
      SELECT 'badge:' || t.id, t.id, t."userId", 'Badge award', 'badges', 'Badge: ' || b.name,
        'awarded', 0, 0, t."unlockedAt", NULL FROM "UserBadge" t JOIN residents u ON u.id = t."userId" JOIN "Badge" b ON b.id = t."badgeId"
      UNION ALL
      SELECT 'streak:' || t."userId" || ':' || t.challenges, t."userId" || ':' || t.challenges, t."userId", 'Streak milestone', 'streaks', t.challenges || '-challenge milestone',
        'awarded', 0, 0, t."awardedAt", NULL FROM "StreakMilestone" t JOIN residents u ON u.id = t."userId"
      UNION ALL
      SELECT 'listing:' || t.id, t.id, t.user_id, 'Swap listing', 'listings', t.title,
        t.approval_status, 0, 0, t.updated_at, json_build_object('createdAt', t.created_at)::text FROM swap_listings t JOIN residents u ON u.id = t.user_id
      UNION ALL
      SELECT 'swap:' || t.id || ':' || u.id, t.id, u.id, 'Swap request', 'swaps', l.title,
        t.status, 0, 0, t.updated_at, json_build_object('fromUserId', t.from_user_id, 'toUserId', t.to_user_id, 'createdAt', t.created_at)::text
        FROM swap_requests t JOIN residents u ON u.id = t.from_user_id OR u.id = t.to_user_id JOIN swap_listings l ON l.id = t.listing_id
      UNION ALL
      SELECT 'audit:' || t.id, t.id, t."userId", 'Admin audit log', 'administration', REPLACE(t.action, '_', ' '),
        'recorded', 0, 0, t.timestamp, t.details FROM audit_logs t JOIN residents u ON u.id = t."userId"
    ), filtered AS (
      SELECT r.*, u.name, u.email, u.barangay, u.points AS "currentPoints", u.coins AS "currentCoins", u.knowledge AS "currentKnowledge"
      FROM records r JOIN residents u ON u.id = r."userId" WHERE TRUE
        ${filters.category === 'all' ? Prisma.empty : Prisma.sql`AND r.category = ${filters.category}`}
        ${filters.status === 'all' ? Prisma.empty : Prisma.sql`AND LOWER(r.status) = LOWER(${filters.status})`}
        ${filters.currency === 'all' ? Prisma.empty : filters.currency === 'points' ? Prisma.sql`AND r.points <> 0` : Prisma.sql`AND r.coins <> 0`}
        ${filters.source === 'all' ? Prisma.empty : Prisma.sql`AND r.source = ${filters.source}`}
        ${filters.start ? Prisma.sql`AND r.at >= ${filters.start}` : Prisma.empty}
        ${filters.end ? Prisma.sql`AND r.at < ${filters.end}` : Prisma.empty}
        ${filters.search ? Prisma.sql`AND (u.name ILIKE ${search} OR u.email ILIKE ${search} OR r.title ILIKE ${search} OR r.reference ILIKE ${search})` : Prisma.empty}
    ), totals AS (SELECT COUNT(*)::int AS total, COUNT(DISTINCT "userId")::int AS users FROM filtered),
    paging AS (SELECT total, users, GREATEST(1, CEIL(total::numeric / ${filters.pageSize})::int) AS pages FROM totals),
    paged AS (SELECT * FROM filtered ORDER BY at DESC, id DESC LIMIT ${filters.pageSize}
      OFFSET (SELECT (LEAST(${filters.page}, pages) - 1) * ${filters.pageSize} FROM paging))
    SELECT json_build_object(
      'items', COALESCE((SELECT json_agg(json_build_object('id', id, 'reference', reference, 'userId', "userId", 'userName', name, 'email', email,
        'barangay', barangay, 'source', source, 'category', category, 'title', title, 'status', LOWER(status), 'points', points, 'coins', coins,
        'timestamp', TO_CHAR(at, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'), 'details', details,
        'currentBalance', json_build_object('points', "currentPoints", 'coins', "currentCoins", 'knowledgePoints', "currentKnowledge")) ORDER BY at DESC, id DESC) FROM paged), '[]'::json),
      'pagination', json_build_object('page', LEAST(${filters.page}, pages), 'pageSize', ${filters.pageSize}::int, 'total', total, 'totalPages', pages),
      'users', users,
      'statuses', COALESCE((SELECT json_agg(status ORDER BY status) FROM (SELECT DISTINCT LOWER(status) AS status FROM records) s), '[]'::json)
    ) AS result FROM paging`;
}

const visibleDetails = new Set(['eventId', 'currency', 'coinCost', 'requestedAt', 'reason', 'submittedAt', 'reviewedAt', 'reviewerId', 'notes', 'rewardClaimed', 'progress', 'completedAt', 'date', 'createdAt', 'fromUserId', 'toUserId', 'adminId', 'submissionId', 'challengeTitle', 'lessonId', 'challengeId', 'ecoCoinsAwarded', 'reservedQuantity', 'status']);
export async function getAdminUserActivity(auth: { role: string }, query: unknown) {
  if (auth.role !== 'admin') throw new HttpError(403, 'User activity is available to admins only.');
  const filters = parseActivityQuery(query);
  const rows = await prisma.$queryRaw<{ result: { items: Array<{ details: string | null }>; pagination: object; users: number; statuses: string[] } }[]>(activityQuery(filters));
  const result = rows[0].result;
  return { ...result, items: result.items.map(item => {
    let details: Record<string, unknown> = {};
    try { const value = JSON.parse(item.details ?? '{}'); if (value && typeof value === 'object') details = Object.fromEntries(Object.entries(value).filter(([key]) => visibleDetails.has(key))); } catch { /* Legacy metadata may be plain text. */ }
    return { ...item, details };
  }), barangays: [...BARANGAYS, 'Unassigned Barangay'], categories: activityCategories, syncedAt: new Date().toISOString() };
}
