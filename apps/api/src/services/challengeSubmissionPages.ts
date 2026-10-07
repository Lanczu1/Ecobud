import { Prisma, type PrismaClient } from '@prisma/client';
import { prisma } from '../prismaClient';

export interface ChallengeSubmissionPageFilters {
  search?: string;
  status?: string;
  userId?: string;
}

const UNASSIGNED = 'Unassigned Barangay';
const GROUPS_PER_PAGE = 3;

// Every submission in scope, labelled with the resident's name and barangay.
function scopedSubmissions(barangay: string | undefined) {
  const scope = !barangay ? Prisma.empty
    : barangay === UNASSIGNED ? Prisma.sql`WHERE COALESCE(NULLIF(BTRIM(p.city, E' \\t\\n\\r'), ''), ${UNASSIGNED}) = ${UNASSIGNED}`
    : Prisma.sql`WHERE p.city ILIKE ${barangay}`;
  return Prisma.sql`
    SELECT cs.id, cs."userId" AS user_id, cs.status::text AS status, cs."moderatorNotes" AS notes,
      c.title AS challenge_title,
      COALESCE(NULLIF(p."displayName", ''), NULLIF(u.name, ''), 'Unknown') AS resident,
      COALESCE(NULLIF(BTRIM(p.city, E' \\t\\n\\r'), ''), ${UNASSIGNED}) AS city
    FROM "ChallengeSubmission" cs
    INNER JOIN users u ON u.id = cs."userId"
    LEFT JOIN "Profile" p ON p."userId" = u.id
    INNER JOIN "ChallengeInstance" ci ON ci.id = cs."challengeInstanceId"
    INNER JOIN "Challenge" c ON c.id = ci."challengeId"
    ${scope}
  `;
}

function matchingSubmissions(barangay: string | undefined, filters: ChallengeSubmissionPageFilters) {
  const search = filters.search?.trim().toLowerCase() || '';
  const conditions = [Prisma.sql`TRUE`];
  if (filters.status) conditions.push(Prisma.sql`s.status = ${filters.status}`);
  if (filters.userId) conditions.push(Prisma.sql`s.user_id = ${filters.userId}`);
  if (search) {
    conditions.push(Prisma.sql`(
      POSITION(${search} IN LOWER(s.resident)) > 0 OR POSITION(${search} IN LOWER(s.city)) > 0
      OR POSITION(${search} IN LOWER(s.challenge_title)) > 0 OR POSITION(${search} IN LOWER(COALESCE(s.notes, ''))) > 0
    )`);
  }
  return Prisma.sql`SELECT s.* FROM (${scopedSubmissions(barangay)}) s WHERE ${Prisma.join(conditions, ' AND ')}`;
}

export async function selectChallengeSubmissionPage(
  barangay: string | undefined,
  requestedPage: number,
  filters: ChallengeSubmissionPageFilters,
  database: Pick<PrismaClient, '$queryRaw'> = prisma,
) {
  const matching = matchingSubmissions(barangay, filters);
  const [residents, groups, [{ residents: totalResidents }]] = await Promise.all([
    database.$queryRaw<{ id: string; name: string; city: string }[]>(Prisma.sql`
      SELECT DISTINCT ON (s.user_id) s.user_id AS id, s.resident AS name, s.city
      FROM (${scopedSubmissions(barangay)}) s ORDER BY s.user_id`),
    database.$queryRaw<{ city: string; total: number; pending: number }[]>(Prisma.sql`
      SELECT m.city, COUNT(*)::int AS total, (COUNT(*) FILTER (WHERE m.status = 'pending'))::int AS pending
      FROM (${matching}) m GROUP BY m.city`),
    database.$queryRaw<{ residents: number }[]>(Prisma.sql`
      SELECT COUNT(DISTINCT m.user_id)::int AS residents FROM (${matching}) m`),
  ]);

  const sorted = groups.sort((left, right) => right.pending - left.pending || left.city.localeCompare(right.city));
  const totalPages = Math.max(1, Math.ceil(sorted.length / GROUPS_PER_PAGE));
  const page = Math.min(Math.max(1, requestedPage), totalPages);
  const pageCities = sorted.slice((page - 1) * GROUPS_PER_PAGE, page * GROUPS_PER_PAGE).map(group => group.city);
  const ids = pageCities.length === 0 ? [] : (await database.$queryRaw<{ id: string }[]>(Prisma.sql`
    SELECT m.id FROM (${matching}) m WHERE m.city IN (${Prisma.join(pageCities)})`)).map(row => row.id);

  return {
    ids,
    pagination: {
      page, pageSize: GROUPS_PER_PAGE, total: sorted.reduce((sum, group) => sum + group.total, 0),
      totalPages, totalBarangays: sorted.length, totalResidents,
    },
    filterOptions: {
      users: residents.map(({ id, name }) => ({ id, name })),
      barangays: [...new Set(residents.map(resident => resident.city))].sort((a, b) => a.localeCompare(b)),
    },
  };
}
