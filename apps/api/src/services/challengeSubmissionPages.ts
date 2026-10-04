import { prisma } from '../prismaClient';

export interface ChallengeSubmissionPageFilters {
  search?: string;
  status?: string;
  userId?: string;
}

export async function selectChallengeSubmissionPage(
  barangay: string | undefined,
  requestedPage: number,
  filters: ChallengeSubmissionPageFilters,
) {
  const rows = await prisma.challengeSubmission.findMany({
    where: barangay && barangay !== 'Unassigned Barangay' ? {
      user: { profile: { city: { equals: barangay, mode: 'insensitive' } } },
    } : undefined,
    select: {
      id: true, userId: true, status: true, moderatorNotes: true,
      user: { select: { name: true, profile: { select: { displayName: true, city: true } } } },
      challengeInstance: { select: { challenge: { select: { title: true } } } },
    },
  });
  const search = filters.search?.trim().toLowerCase() || '';
  const groups = new Map<string, { ids: string[]; pending: number }>();
  const users = new Map<string, string>();
  const matchingResidents = new Set<string>();
  const barangays = new Set<string>();
  for (const row of rows) {
    const name = row.user.profile?.displayName || row.user.name || 'Unknown';
    const city = row.user.profile?.city?.trim() || 'Unassigned Barangay';
    if (barangay === 'Unassigned Barangay' && city !== barangay) continue;
    users.set(row.userId, name);
    barangays.add(city);
    if (filters.status && row.status !== filters.status) continue;
    if (filters.userId && row.userId !== filters.userId) continue;
    if (search && ![name, city, row.challengeInstance.challenge.title, row.moderatorNotes || '']
      .some(value => value.toLowerCase().includes(search))) continue;
    const group = groups.get(city) || { ids: [], pending: 0 };
    matchingResidents.add(row.userId);
    group.ids.push(row.id);
    if (row.status === 'pending') group.pending += 1;
    groups.set(city, group);
  }
  const sorted = [...groups.entries()].sort(([a, left], [b, right]) =>
    right.pending - left.pending || a.localeCompare(b));
  const totalPages = Math.max(1, Math.ceil(sorted.length / 3));
  const page = Math.min(Math.max(1, requestedPage), totalPages);
  return {
    ids: sorted.slice((page - 1) * 3, page * 3).flatMap(([, group]) => group.ids),
    pagination: {
      page, pageSize: 3, total: sorted.reduce((sum, [, group]) => sum + group.ids.length, 0),
      totalPages, totalBarangays: sorted.length, totalResidents: matchingResidents.size,
    },
    filterOptions: {
      users: [...users].map(([id, name]) => ({ id, name })),
      barangays: [...barangays].sort((a, b) => a.localeCompare(b)),
    },
  };
}
