import { Prisma } from '@prisma/client';

// Counts distinct active residents and signups for each given day in the database.
// Prisma stores DateTime columns as UTC without a zone, so those are read back
// as UTC before being compared with the day boundaries.
export function activityByDayQuery(days: { start: Date; end: Date }[]) {
  const windowStart = days[0].start;
  const dayRows = days.map((day, idx) =>
    Prisma.sql`(${idx}::int, ${day.start}::timestamptz, ${day.end}::timestamptz)`);
  return Prisma.sql`
    WITH days(idx, day_start, day_end) AS (VALUES ${Prisma.join(dayRows)}),
    bounds AS (SELECT ${windowStart}::timestamptz AS at_tz, (${windowStart}::timestamptz AT TIME ZONE 'UTC') AS at_utc),
    activity AS (
      SELECT ps.user_id, t.at
      FROM presence_sessions ps, bounds b, LATERAL (VALUES (ps.last_seen_at), (ps.connected_at), (ps.updated_at)) AS t(at)
      WHERE ps.last_seen_at >= b.at_tz OR ps.connected_at >= b.at_tz OR ps.updated_at >= b.at_tz
      UNION ALL
      SELECT u.id, t.at AT TIME ZONE 'UTC'
      FROM users u, bounds b, LATERAL (VALUES (u.last_action_date), (u.created_at)) AS t(at)
      WHERE u.last_action_date >= b.at_utc OR u.created_at >= b.at_utc
      UNION ALL
      SELECT lp.user_id, t.at AT TIME ZONE 'UTC'
      FROM lesson_progress lp, bounds b, LATERAL (VALUES (lp.updated_at), (lp.created_at)) AS t(at)
      WHERE lp.updated_at >= b.at_utc OR lp.created_at >= b.at_utc
      UNION ALL
      SELECT cs."userId", t.at AT TIME ZONE 'UTC'
      FROM "ChallengeSubmission" cs, bounds b, LATERAL (VALUES (cs.created_at), (cs.updated_at)) AS t(at)
      WHERE cs.created_at >= b.at_utc OR cs.updated_at >= b.at_utc
      UNION ALL
      SELECT hc."userId", hc."createdAt" AT TIME ZONE 'UTC'
      FROM "HabitCheckIn" hc, bounds b
      WHERE hc."createdAt" >= b.at_utc
    ),
    resident_activity AS (
      SELECT a.user_id, a.at FROM activity a
      INNER JOIN users u ON u.id = a.user_id AND u.role::text = 'user'
    )
    SELECT d.idx,
      COUNT(DISTINCT ra.user_id)::int AS active,
      (SELECT COUNT(*)::int FROM users s
        WHERE s.role::text = 'user'
          AND s.created_at AT TIME ZONE 'UTC' BETWEEN d.day_start AND d.day_end) AS signups
    FROM days d
    LEFT JOIN resident_activity ra ON ra.at BETWEEN d.day_start AND d.day_end
    GROUP BY d.idx, d.day_start, d.day_end
    ORDER BY d.idx
  `;
}
