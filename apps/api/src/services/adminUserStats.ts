import { Prisma, type PrismaClient } from '@prisma/client';

export async function getAdminUserStats(
  database: Pick<PrismaClient, '$queryRaw'>,
  role: string | undefined,
  snapshotDate: Date,
) {
  const roleFilter = role === 'staff'
    ? Prisma.sql`u.role::text IN ('admin', 'moderator')`
    : role ? Prisma.sql`u.role::text = ${role}` : Prisma.sql`TRUE`;
  const [stats] = await database.$queryRaw<{ total: number; online: number; offline: number }[]>(Prisma.sql`
    WITH counts AS (
      SELECT COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE u.role::text = 'user' AND EXISTS (
          SELECT 1 FROM presence_sessions ps
          WHERE ps.user_id = u.id AND ps.is_online = TRUE AND ps.expires_at > ${snapshotDate}
        ))::int AS online
      FROM users u WHERE ${roleFilter}
    )
    SELECT total, online, total - online AS offline FROM counts
  `);
  return stats;
}
