import { createHash } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import { prisma } from '../prismaClient';
import { HttpError } from '../http/errorResponder';
import { listEventPhotoDeletionRequests, photoDeleteDetails, reviewerScope } from './eventPhotoDeletion';

export const CHALLENGE_PHOTO_DELETE_PENDING = 'CHALLENGE_PHOTO_DELETE_PENDING';
export const CHALLENGE_PHOTO_DELETE_APPROVED = 'CHALLENGE_PHOTO_DELETE_APPROVED';
export type ChallengePhotoField = 'proofUrl' | 'afterProofUrl';
export const challengePhotoRequestPrefix = (id: string, field: ChallengePhotoField) => `challenge-photo-delete:${id}:${field}:`;
export const challengePhotoRequestId = (id: string, field: ChallengePhotoField, url: string) => `${challengePhotoRequestPrefix(id, field)}${createHash('sha256').update(url).digest('hex').slice(0, 24)}`;
type Reviewer = { userId: string; role: string; city?: string | null };
async function lockSubmission(tx: Prisma.TransactionClient, id: string) {
  await tx.$queryRaw`SELECT id FROM "ChallengeSubmission" WHERE id = ${id} FOR UPDATE`;
}

export async function requestChallengePhotoDeletion(userId: string, id: string, field: ChallengePhotoField, reason: string, photoUrl: string) {
  return prisma.$transaction(async tx => {
    await lockSubmission(tx, id);
    const submission = await tx.challengeSubmission.findUnique({ where: { id }, include: { challengeInstance: { select: { challenge: { select: { title: true } } } } } });
    if (!submission || submission.userId !== userId) throw new HttpError(404, 'Challenge photo not found.');
    if (submission.status !== 'approved' && !submission.rewardAwarded) throw new HttpError(409, 'Photo deletion is available after the challenge submission has been approved.');
    if (!submission[field] || submission[field] !== photoUrl) throw new HttpError(409, 'The challenge photo has changed. Refresh your history.');
    const requestId = challengePhotoRequestId(id, field, photoUrl);
    const existing = await tx.auditLog.findUnique({ where: { id: requestId } });
    if (existing?.action === CHALLENGE_PHOTO_DELETE_PENDING) return { id: requestId, status: 'pending' as const, reason: photoDeleteDetails(existing.details).reason };
    if (existing) throw new HttpError(409, 'This photo request has already been reviewed.');
    await tx.auditLog.create({ data: {
      id: requestId, userId, action: CHALLENGE_PHOTO_DELETE_PENDING,
      details: JSON.stringify({ submissionId: id, eventId: submission.challengeInstanceId, eventTitle: submission.challengeInstance.challenge.title, photoField: field, reason, photoUrl }),
    } });
    return { id: requestId, status: 'pending' as const, reason };
  });
}

export function listChallengePhotoDeletionRequests(auth: Reviewer, status: 'pending' | 'approved', page: number, pageSize: number) {
  return listEventPhotoDeletionRequests(auth, status, page, pageSize, { pending: CHALLENGE_PHOTO_DELETE_PENDING, approved: CHALLENGE_PHOTO_DELETE_APPROVED });
}

export async function approveChallengePhotoDeletion(auth: Reviewer, requestId: string) {
  const scope = reviewerScope(auth);
  return prisma.$transaction(async tx => {
    const request = await tx.auditLog.findFirst({ where: { ...scope, id: requestId, action: { in: [CHALLENGE_PHOTO_DELETE_PENDING, CHALLENGE_PHOTO_DELETE_APPROVED] } } });
    if (!request) throw new HttpError(404, 'Challenge photo delete request not found.');
    const details = photoDeleteDetails(request.details);
    const field = (JSON.parse(request.details!) as { photoField?: string }).photoField;
    if (field !== 'proofUrl' && field !== 'afterProofUrl') throw new HttpError(409, 'Invalid challenge photo request.');
    await lockSubmission(tx, details.submissionId);
    const current = await tx.auditLog.findUnique({ where: { id: requestId } });
    if (current?.action === CHALLENGE_PHOTO_DELETE_APPROVED) return { userId: request.userId, challengeInstanceId: details.eventId, alreadyApproved: true };
    const updated = await tx.challengeSubmission.updateMany({
      where: { id: details.submissionId, userId: request.userId!, [field]: details.photoUrl, OR: [{ status: 'approved' }, { rewardAwarded: true }] },
      data: { [field]: null },
    });
    if (!updated.count) throw new HttpError(409, 'The requested photo has changed or no longer exists.');
    await tx.auditLog.update({ where: { id: requestId }, data: {
      action: CHALLENGE_PHOTO_DELETE_APPROVED,
      details: JSON.stringify({ ...details, photoField: field, reviewedById: auth.userId, reviewedAt: new Date().toISOString() }),
    } });
    return { userId: request.userId, challengeInstanceId: details.eventId, alreadyApproved: false };
  });
}

export async function challengePhotoDeletionStatuses(userId: string, submissions: { id: string; proofUrl: string | null; afterProofUrl: string | null }[]) {
  type Status = { id: string; status: 'pending' | 'approved'; reason: string };
  const result = new Map<string, Partial<Record<ChallengePhotoField, Status>>>();
  if (!submissions.length) return result;
  const rows = await prisma.auditLog.findMany({
    where: { userId, action: { in: [CHALLENGE_PHOTO_DELETE_PENDING, CHALLENGE_PHOTO_DELETE_APPROVED] }, OR: submissions.flatMap(sub => (['proofUrl', 'afterProofUrl'] as const).map(field => sub[field]
      ? { id: challengePhotoRequestId(sub.id, field, sub[field]!) }
      : { id: { startsWith: challengePhotoRequestPrefix(sub.id, field) }, action: CHALLENGE_PHOTO_DELETE_APPROVED })) },
    select: { id: true, action: true, details: true }, orderBy: [{ timestamp: 'asc' }, { id: 'asc' }],
  });
  for (const row of rows) {
    const details = photoDeleteDetails(row.details);
    const field = (JSON.parse(row.details!) as { photoField?: string }).photoField;
    if (field !== 'proofUrl' && field !== 'afterProofUrl') continue;
    result.set(details.submissionId, { ...result.get(details.submissionId), [field]: { id: row.id, status: row.action === CHALLENGE_PHOTO_DELETE_APPROVED ? 'approved' : 'pending', reason: details.reason } });
  }
  return result;
}
