import { Prisma } from '@prisma/client';
import { prisma } from '../prismaClient';
import { reportScope } from './barangayReports';

export interface EventReportStats {
  totalRegistered: number;
  attended: number;
  qrVerified: number;
  pendingVerification: number;
  approved: number;
  rejected: number;
  totalCoinsAwarded: number;
  totalExpAwarded: number;
}

export function eventReportSummaryQuery(ids: string[], barangay: string | null) {
  return Prisma.sql`
    SELECT e.id AS "eventId", r."totalRegistered", r.attended,
      s."qrVerified", s."pendingVerification", s.approved, s.rejected,
      w."totalCoinsAwarded", w."totalExpAwarded"
    FROM "Event" e
    CROSS JOIN LATERAL (
      SELECT COUNT(*)::int AS "totalRegistered", COUNT("attendedAt")::int AS attended
      FROM "EventRegistration" WHERE "eventId" = e.id
    ) r
    CROSS JOIN LATERAL (
      SELECT COUNT(*) FILTER (WHERE qr_verified)::int AS "qrVerified",
        COUNT(*) FILTER (WHERE status = 'pending')::int AS "pendingVerification",
        COUNT(*) FILTER (WHERE status = 'approved')::int AS approved,
        COUNT(*) FILTER (WHERE status = 'rejected')::int AS rejected
      FROM event_submissions WHERE event_id = e.id
    ) s
    CROSS JOIN LATERAL (
      SELECT COALESCE(SUM(amount) FILTER (WHERE type = 'eco_coins'), 0)::bigint AS "totalCoinsAwarded",
        COALESCE(SUM(ABS(amount::bigint)) FILTER (WHERE type = 'exp'), 0)::bigint AS "totalExpAwarded"
      FROM reward_transactions WHERE event_id = e.id
    ) w
    WHERE e.id IN (${Prisma.join(ids)})
      ${barangay ? Prisma.sql`AND e.barangay = ${barangay}` : Prisma.empty}
  `;
}

export async function getEventReportSummaries(auth: { role: string; city?: string | null }, ids: string[]) {
  const barangay = reportScope(auth);
  if (ids.length === 0) return [];
  const rows = await prisma.$queryRaw<Array<{ eventId: string } & Record<keyof EventReportStats, number | bigint>>>(eventReportSummaryQuery(ids, barangay));
  return rows.map(row => ({
    eventId: row.eventId,
    stats: {
      totalRegistered: Number(row.totalRegistered),
      attended: Number(row.attended),
      qrVerified: Number(row.qrVerified),
      pendingVerification: Number(row.pendingVerification),
      approved: Number(row.approved),
      rejected: Number(row.rejected),
      totalCoinsAwarded: Number(row.totalCoinsAwarded),
      totalExpAwarded: Number(row.totalExpAwarded),
    },
  }));
}
