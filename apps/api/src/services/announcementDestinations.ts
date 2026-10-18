import { prisma } from '../prismaClient';
import { HttpError } from '../http/errorResponder';
import type { DestinationKind } from './announcementRules';

export type DestinationAudience = { targetAudience: string; barangays: string[] };

/** A record an admin can pick as the button's destination. unavailableReason explains why residents could not open it. */
export type DestinationOption = { id: string; title: string; detail: string; unavailableReason: string | null };

type ChallengeRecord = { id: string; title: string; category: string | null; difficulty: string; active: boolean; startDate: Date | null; endDate: Date | null };
type EventRecord = { id: string; title: string; barangay: string | null; isPublished: boolean; startDatetime: Date; endDatetime: Date };
type LessonRecord = { id: string; title: string; category: string; isPublished: boolean; scheduledAt: Date | null };

const kindLabel: Record<DestinationKind, string> = { challenge: 'challenge', event: 'event', lesson: 'learning module' };
const day = (value: Date) => value.toLocaleDateString('en-PH', { timeZone: 'Asia/Manila', dateStyle: 'medium' });
const sameBarangay = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

// The same rules the resident app uses to list these records, checked at the moment residents first see the button.
export function challengeProblem(challenge: ChallengeRecord, at: Date): string | null {
  if (!challenge.active) return 'This challenge is turned off, so residents cannot open it.';
  if (challenge.endDate && challenge.endDate <= at) return `This challenge ended on ${day(challenge.endDate)}.`;
  if (challenge.startDate && challenge.startDate > at) return `This challenge starts on ${day(challenge.startDate)}, after the announcement goes live.`;
  return null;
}

export function eventProblem(event: EventRecord, audience: DestinationAudience): string | null {
  if (!event.isPublished) return 'This event is not published, so residents cannot open it.';
  if (!event.barangay) return null;
  const reachesOthers = audience.targetAudience === 'All Residents' || audience.barangays.some(b => !sameBarangay(b, event.barangay!));
  return reachesOthers ? `Only residents of Brgy. ${event.barangay} can open this event. Target only that barangay or choose another event.` : null;
}

export function lessonProblem(lesson: LessonRecord, at: Date): string | null {
  if (lesson.isPublished) return null;
  if (lesson.scheduledAt && lesson.scheduledAt <= at) return null;
  if (lesson.scheduledAt) return `This learning module publishes on ${day(lesson.scheduledAt)}, after the announcement goes live.`;
  return 'This learning module is not published, so residents cannot open it.';
}

function challengeOption(challenge: ChallengeRecord, at: Date): DestinationOption {
  const timing = challenge.endDate ? `Ends ${day(challenge.endDate)}` : 'No end date';
  return { id: challenge.id, title: challenge.title, detail: `${challenge.category || challenge.difficulty} · ${timing}`, unavailableReason: challengeProblem(challenge, at) };
}

function eventOption(event: EventRecord, audience: DestinationAudience): DestinationOption {
  return { id: event.id, title: event.title, detail: `${day(event.startDatetime)} · ${event.barangay ? `Brgy. ${event.barangay}` : 'All barangays'}`, unavailableReason: eventProblem(event, audience) };
}

function lessonOption(lesson: LessonRecord, at: Date): DestinationOption {
  return { id: lesson.id, title: lesson.title, detail: lesson.category, unavailableReason: lessonProblem(lesson, at) };
}

const challengeSelect = { id: true, title: true, category: true, difficulty: true, active: true, startDate: true, endDate: true } as const;
const eventSelect = { id: true, title: true, barangay: true, isPublished: true, startDatetime: true, endDatetime: true } as const;
const lessonSelect = { id: true, title: true, category: true, isPublished: true, scheduledAt: true } as const;

/** Records of one kind whose title matches search, or the one record with id, each with its availability for this audience. */
export async function findDestinations(kind: DestinationKind, options: { search?: string; id?: string; audience: DestinationAudience; at: Date; take?: number }) {
  const take = options.take ?? 20;
  const title = options.search ? { contains: options.search, mode: 'insensitive' as const } : undefined;
  const where = options.id ? { id: options.id } : title ? { title } : {};
  if (kind === 'challenge') {
    const rows = await prisma.challenge.findMany({ where, select: challengeSelect, orderBy: [{ active: 'desc' }, { updatedAt: 'desc' }], take });
    return rows.map(row => challengeOption(row, options.at));
  }
  if (kind === 'event') {
    const rows = await prisma.event.findMany({ where, select: eventSelect, orderBy: [{ startDatetime: 'desc' }], take });
    return rows.map(row => eventOption(row, options.audience));
  }
  const rows = await prisma.lesson.findMany({ where, select: lessonSelect, orderBy: [{ createdAt: 'desc' }], take });
  return rows.map(row => lessonOption(row, options.at));
}

/**
 * Rejects a destination that no longer exists, and, once residents will see the announcement (Published or
 * Scheduled), one they could not open. Drafts and archived announcements may keep a destination that is not ready yet.
 */
export async function assertDestination(kind: DestinationKind, id: string, audience: DestinationAudience, liveAt: Date | null) {
  const [found] = await findDestinations(kind, { id, audience, at: liveAt ?? new Date(), take: 1 });
  if (!found) throw new HttpError(400, `The selected ${kindLabel[kind]} no longer exists. Choose another destination or turn off the action button.`);
  if (liveAt && found.unavailableReason) throw new HttpError(400, `${found.title}: ${found.unavailableReason}`);
}
