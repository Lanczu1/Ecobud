import type { Prisma } from '@prisma/client';
import { createHash } from 'node:crypto';
import { prisma } from '../prismaClient';
import { HttpError } from '../http/errorResponder';
import { eventBarangay } from './eventAccess';
import { paginatedResult } from '../utils/adminPagination';

export const PHOTO_DELETE_PENDING = 'EVENT_PHOTO_DELETE_PENDING';
export const PHOTO_DELETE_APPROVED = 'EVENT_PHOTO_DELETE_APPROVED';
export const photoDeleteRequestPrefix = (submissionId: string) => `event-photo-delete:${submissionId}:`;
export const photoDeleteRequestId = (submissionId: string, photoUrl: string) => `${photoDeleteRequestPrefix(submissionId)}${createHash('sha256').update(photoUrl).digest('hex').slice(0, 24)}`;

interface RequestDetails {
  submissionId: string;
  eventId: string;
  eventTitle: string;
  photoUrl: string;
  reason: string;
  photos?: { proofUrl: string | null; afterProofUrl: string | null };
  reviewedById?: string;
  reviewedAt?: string;
}

export function photoDeleteDetails(details: string | null): RequestDetails {
  try {
    const value = JSON.parse(details ?? 'null');
    if (!value || !['submissionId', 'eventId', 'eventTitle', 'photoUrl', 'reason'].every(key => typeof value[key] === 'string')) throw new Error();
    return value;
  } catch { throw new HttpError(409, 'This photo request could not be read.'); }
}

async function lockSubmission(tx: Prisma.TransactionClient, submissionId: string) {
  await tx.$queryRaw`SELECT id FROM event_submissions WHERE id = ${submissionId} FOR UPDATE`;
}

export async function requestEventPhotoDeletion(userId: string, submissionId: string, reason: string, photoUrl: string) {
  return prisma.$transaction(async tx => {
    await lockSubmission(tx, submissionId);
    const submission = await tx.eventSubmission.findUnique({ where: { id: submissionId }, include: { event: { select: { title: true } } } });
    if (!submission || submission.userId !== userId) throw new HttpError(404, 'Attendance photo not found.');
    if (!submission.attendanceImageUrl || submission.attendanceImageUrl !== photoUrl) throw new HttpError(409, 'The attendance photo has changed. Refresh your history.');
    const id = photoDeleteRequestId(submissionId, photoUrl);
    const existing = await tx.auditLog.findUnique({ where: { id } });
    if (existing?.action === PHOTO_DELETE_PENDING) return { id, status: 'pending' as const, reason: photoDeleteDetails(existing.details).reason };
    if (existing) throw new HttpError(409, 'This photo request has already been reviewed.');
    const details: RequestDetails = { submissionId, eventId: submission.eventId, eventTitle: submission.event.title, photoUrl, reason };
    await tx.auditLog.create({ data: { id, action: PHOTO_DELETE_PENDING, userId, details: JSON.stringify(details) } });
    return { id, status: 'pending' as const, reason };
  });
}

type Reviewer = { userId: string; role: string; city?: string | null };
export function reviewerScope(auth: Reviewer): Prisma.AuditLogWhereInput {
  if (auth.role === 'admin') return {};
  const barangay = eventBarangay(auth.city);
  if (auth.role !== 'moderator' || !barangay) throw new HttpError(403, 'An assigned barangay is required to review photo requests.');
  return { user: { profile: { city: { equals: barangay, mode: 'insensitive' } } } };
}

export async function listEventPhotoDeletionRequests(auth: Reviewer, status: 'pending' | 'approved', page: number, pageSize: number, actions = { pending: PHOTO_DELETE_PENDING, approved: PHOTO_DELETE_APPROVED }) {
  const where: Prisma.AuditLogWhereInput = { ...reviewerScope(auth), action: actions[status] };
  const otherStatus = status === 'pending' ? 'approved' : 'pending';
  // The other tab's total comes with the page, so the screen shows both counts from one request.
  const [rows, total, otherTotal] = await Promise.all([
    prisma.auditLog.findMany({ where, include: { user: { select: { id: true, name: true, profile: { select: { displayName: true, city: true } } } } }, orderBy: [{ timestamp: 'desc' }, { id: 'desc' }], skip: (page - 1) * pageSize, take: pageSize }),
    prisma.auditLog.count({ where }),
    prisma.auditLog.count({ where: { ...reviewerScope(auth), action: actions[otherStatus] } }),
  ]);
  const result = paginatedResult(rows.map(row => {
    const details = photoDeleteDetails(row.details);
    return { id: row.id, status, requestedAt: row.timestamp, user: row.user, ...details, photoUrl: status === 'pending' ? details.photoUrl : null, ...(details.photos ? { photos: status === 'pending' ? details.photos : null } : {}) };
  }), page, pageSize, total);
  return { ...result, counts: status === 'pending' ? { pending: total, approved: otherTotal } : { pending: otherTotal, approved: total } };
}

export async function approveEventPhotoDeletion(auth: Reviewer, requestId: string) {
  const scope = reviewerScope(auth);
  return prisma.$transaction(async tx => {
    const request = await tx.auditLog.findFirst({ where: { ...scope, id: requestId, action: { in: [PHOTO_DELETE_PENDING, PHOTO_DELETE_APPROVED] } } });
    if (!request) throw new HttpError(404, 'Photo delete request not found.');
    const details = photoDeleteDetails(request.details);
    await lockSubmission(tx, details.submissionId);
    const current = await tx.auditLog.findUnique({ where: { id: requestId } });
    if (current?.action === PHOTO_DELETE_APPROVED) return { userId: request.userId, eventId: details.eventId, alreadyApproved: true };
    const updated = await tx.eventSubmission.updateMany({
      where: { id: details.submissionId, userId: request.userId!, attendanceImageUrl: details.photoUrl },
      data: { attendanceImageUrl: '' },
    });
    if (!updated.count) throw new HttpError(409, 'The requested photo has changed or no longer exists. Refresh the requests.');
    await tx.auditLog.update({ where: { id: requestId }, data: {
      action: PHOTO_DELETE_APPROVED,
      details: JSON.stringify({ ...details, reviewedById: auth.userId, reviewedAt: new Date().toISOString() }),
    } });
    return { userId: request.userId, eventId: details.eventId, alreadyApproved: false };
  });
}
