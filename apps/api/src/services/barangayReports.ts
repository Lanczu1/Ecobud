import { Prisma } from '@prisma/client';
import { prisma } from '../prismaClient';
import { HttpError } from '../http/errorResponder';
import { BARANGAYS } from '../utils/announcementBarangays';
import { effectiveAnnouncementStatus } from './announcementRules';
import { eventBarangay } from './eventAccess';

type ReportAuth = { role: string; city?: string | null };
export async function authorizeEventReport(auth: ReportAuth, eventId: string) {
  const barangay = reportScope(auth);
  if (!barangay) return;
  const event = await prisma.event.findUnique({ where: { id: eventId }, select: { barangay: true } });
  if (!event) throw new HttpError(404, 'Event not found.');
  if (event.barangay !== barangay) throw new HttpError(403, 'Reports are limited to events in your assigned barangay.');
}
export function reportScope(auth: ReportAuth, requested?: unknown): string | null {
  if (!['admin', 'moderator'].includes(auth.role)) throw new HttpError(403, 'Reports require moderator access.');
  if (requested !== undefined && typeof requested !== 'string') throw new HttpError(400, 'Choose a valid barangay.');
  const chosen = requested && requested !== 'all' ? eventBarangay(String(requested)) : null;
  if (requested && requested !== 'all' && !chosen) throw new HttpError(400, 'Choose a valid barangay.');
  if (auth.role === 'admin') return chosen;
  const assigned = eventBarangay(auth.city);
  if (!assigned) throw new HttpError(403, 'Your moderator account needs an assigned barangay.');
  if (requested !== undefined && requested !== assigned && chosen !== assigned) throw new HttpError(403, 'Reports are limited to your assigned barangay.');
  return assigned;
}

export function reportPeriod(query: { from?: unknown; to?: unknown }, now = new Date()) {
  const today = new Date(now.getTime() + 8 * 3600000).toISOString().slice(0, 10);
  const from = query.from ?? `${today.slice(0, 7)}-01`;
  const to = query.to ?? today;
  const parse = (value: unknown) => {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new HttpError(400, 'Use YYYY-MM-DD dates.');
    const date = new Date(`${value}T00:00:00+08:00`);
    if (!Number.isFinite(date.getTime()) || new Date(date.getTime() + 8 * 3600000).toISOString().slice(0, 10) !== value) throw new HttpError(400, 'Choose a valid date.');
    return date;
  };
  const start = parse(from);
  const end = new Date(parse(to).getTime() + 86400000);
  if (start >= end || end.getTime() - start.getTime() > 366 * 86400000) throw new HttpError(400, 'Choose a date range of at most 366 days, with the start before the end.');
  return { from: String(from), to: String(to), range: { gte: start, lt: end } };
}

export async function getBarangayReport(auth: ReportAuth, query: { barangay?: unknown; from?: unknown; to?: unknown }, now = new Date()) {
  const barangay = reportScope(auth, query.barangay);
  const period = reportPeriod(query, now);
  const resident: Prisma.UserWhereInput = { role: 'user', ...(barangay ? { profile: { city: { equals: barangay, mode: 'insensitive' } } } : {}) };
  const event: Prisma.EventWhereInput = barangay ? { barangay } : {};
  const submission = { user: resident, createdAt: period.range };
  const announcement: Prisma.AnnouncementWhereInput = {
    AND: [
      { OR: [{ status: 'Published' }, { status: { in: ['Scheduled', 'Archived'] }, publishAt: { lte: now } }] },
      { OR: [{ publishAt: period.range }, { publishAt: null, createdAt: period.range }] },
      ...(barangay ? [{ OR: [{ targetAudience: 'All Residents' }, { barangays: { has: barangay } }] }] : []),
    ],
  };
  const [residents, newResidents, activeResidents, announcementCount, announcements, submitted, pending, approved, rejected, completed,
    events, registrations, attended, pendingAttendance, lessons, learners, rewardTotals, badges, listings, pendingListings, swaps, redeem] = await Promise.all([
    prisma.user.count({ where: resident }),
    prisma.user.count({ where: { ...resident, createdAt: period.range } }),
    prisma.user.count({ where: { ...resident, lastActionDate: period.range } }),
    prisma.announcement.count({ where: announcement }),
    prisma.announcement.findMany({ where: announcement, select: { id: true, title: true, status: true, category: true, publishAt: true, expiresAt: true, createdAt: true }, orderBy: [{ publishAt: 'desc' }, { createdAt: 'desc' }], take: 20 }),
    prisma.challengeSubmission.count({ where: submission }),
    prisma.challengeSubmission.count({ where: { ...submission, status: { in: ['pending', 'flagged', 'final_review', 'approved_collection'] } } }),
    prisma.challengeSubmission.count({ where: { ...submission, status: 'approved' } }),
    prisma.challengeSubmission.count({ where: { ...submission, status: 'rejected' } }),
    prisma.userChallenge.count({ where: { user: resident, status: 'COMPLETED', completedAt: period.range } }),
    prisma.event.count({ where: { ...event, startDatetime: period.range } }),
    prisma.eventRegistration.count({ where: { event, registeredAt: period.range } }),
    prisma.eventRegistration.count({ where: { event, attendedAt: period.range } }),
    prisma.eventSubmission.count({ where: { event, submittedAt: period.range, status: 'pending' } }),
    prisma.userLessonProgress.count({ where: { user: resident, status: 'completed', completedAt: period.range } }),
    prisma.user.count({ where: { ...resident, lessonProgress: { some: { status: 'completed', completedAt: period.range } } } }),
    prisma.rewardTransaction.groupBy({ by: ['type'], where: { user: resident, createdAt: period.range, amount: { gt: 0 } }, _sum: { amount: true } }),
    prisma.userBadge.count({ where: { user: resident, unlockedAt: period.range } }),
    prisma.swapListing.count({ where: { user: resident, createdAt: period.range } }),
    prisma.swapListing.count({ where: { user: resident, createdAt: period.range, approvalStatus: 'pending' } }),
    prisma.swapRequest.count({ where: { status: 'completed', updatedAt: period.range, OR: [{ fromUser: resident }, { toUser: resident }] } }),
    prisma.$queryRaw<{ status: string; count: bigint }[]>(Prisma.sql`
      SELECT r.status, COUNT(*) AS count FROM redeem_requests r
      JOIN users u ON u.id = r.user_id
      WHERE u.role = 'user' AND r.created_at >= ${period.range.gte} AND r.created_at < ${period.range.lt}
      ${barangay ? Prisma.sql`AND EXISTS (SELECT 1 FROM "Profile" p WHERE p."userId" = u.id AND LOWER(p.city) = LOWER(${barangay}))` : Prisma.empty}
      GROUP BY r.status`),
  ]);
  const sections = [
    { title: 'Barangay Overview', metrics: { 'Registered residents (current)': residents, 'New registrations': newResidents, 'Residents with last activity in period': activeResidents } },
    { title: 'Announcements', metrics: { 'Published announcements in period': announcementCount } },
    { title: 'Challenges', metrics: { 'Submitted proofs': submitted, 'Awaiting review': pending, 'Approved proofs': approved, 'Rejected proofs': rejected, 'Completed challenges': completed } },
    { title: 'Events', metrics: { 'Events starting in period': events, 'Registrations in period': registrations, 'Verified attendance in period': attended, 'Pending attendance proofs': pendingAttendance } },
    { title: 'Learning Progress', metrics: { 'Completed lessons': lessons, 'Residents completing lessons': learners } },
    { title: 'Rewards & Badges', metrics: { 'Eco Points awarded': rewardTotals.find(r => r.type === 'exp')?._sum.amount ?? 0, 'Eco Coins awarded': rewardTotals.find(r => r.type === 'eco_coins')?._sum.amount ?? 0, 'Badges awarded': badges } },
    { title: 'Give & Get', metrics: { 'Resident listings created': listings, 'Listings awaiting moderation': pendingListings, 'Completed swaps involving residents': swaps } },
    { title: 'Redeem Requests', metrics: Object.fromEntries(['pending', 'approved', 'rejected', 'ready_to_claim', 'claimed'].map(status => [status.replaceAll('_', ' '), Number(redeem.find(r => r.status === status)?.count ?? 0)])) },
  ];
  return { barangay, barangays: auth.role === 'admin' ? BARANGAYS : [barangay!], from: period.from, to: period.to, generatedAt: now.toISOString(), sections,
    announcements: announcements.map(a => ({ ...a, status: effectiveAnnouncementStatus(a, now), publishedAt: (a.publishAt ?? a.createdAt).toISOString() })),
    notes: 'Dates use Asia/Manila. Resident metrics use current profile barangays. Events use their assigned barangay and include all participants. Review statuses are current for records submitted in the period. Swap completion uses the last update date. Rewards count positive ledger credits, excluding spending. Announcement details show the latest 20; totals include all matching records.' };
}
