import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const tx = {
    $queryRaw: vi.fn(),
    eventSubmission: { findUnique: vi.fn(), updateMany: vi.fn() },
    auditLog: { findUnique: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
  };
  return { tx, transaction: vi.fn(), findMany: vi.fn(), count: vi.fn() };
});
vi.mock('../prismaClient', () => ({ prisma: { $transaction: mocks.transaction, auditLog: { findMany: mocks.findMany, count: mocks.count } } }));
import { approveEventPhotoDeletion, listEventPhotoDeletionRequests, requestEventPhotoDeletion, photoDeleteRequestId, PHOTO_DELETE_APPROVED, PHOTO_DELETE_PENDING } from './eventPhotoDeletion';

const details = { submissionId: 'one', eventId: 'event-one', eventTitle: 'Clean-up', photoUrl: 'https://example.test/one.jpg', reason: 'Please remove my photo' };
const log = { id: photoDeleteRequestId('one', details.photoUrl), userId: 'alice', action: PHOTO_DELETE_PENDING, details: JSON.stringify(details) };
const admin = { userId: 'admin', role: 'admin' };

describe('event photo deletion requests', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.transaction.mockImplementation(callback => callback(mocks.tx));
    mocks.tx.$queryRaw.mockResolvedValue([{ id: 'one' }]);
    mocks.tx.eventSubmission.findUnique.mockResolvedValue({ id: 'one', userId: 'alice', eventId: details.eventId, attendanceImageUrl: details.photoUrl, event: { title: details.eventTitle } });
    mocks.tx.auditLog.findUnique.mockResolvedValue(null);
    mocks.tx.auditLog.findFirst.mockResolvedValue(log);
    mocks.tx.eventSubmission.updateMany.mockResolvedValue({ count: 1 });
    mocks.findMany.mockResolvedValue([]);
    mocks.count.mockResolvedValue(0);
  });

  it('stores one request with its reason and photo snapshot without changing attendance', async () => {
    expect(await requestEventPhotoDeletion('alice', 'one', details.reason, details.photoUrl)).toMatchObject({ status: 'pending', reason: details.reason });
    expect(mocks.tx.$queryRaw).toHaveBeenCalledOnce();
    expect(mocks.tx.auditLog.create).toHaveBeenCalledWith({ data: log });
    expect(mocks.tx.eventSubmission.updateMany).not.toHaveBeenCalled();
  });

  it('prevents requests for another user photo', async () => {
    await expect(requestEventPhotoDeletion('bob', 'one', details.reason, details.photoUrl)).rejects.toMatchObject({ statusCode: 404 });
    expect(mocks.tx.auditLog.create).not.toHaveBeenCalled();
  });

  it('rejects a request for an outdated photo', async () => {
    await expect(requestEventPhotoDeletion('alice', 'one', details.reason, 'old.jpg')).rejects.toMatchObject({ statusCode: 409 });
    expect(mocks.tx.auditLog.create).not.toHaveBeenCalled();
  });

  it('returns an existing pending request on duplicate submissions', async () => {
    mocks.tx.auditLog.findUnique.mockResolvedValue(log);
    expect(await requestEventPhotoDeletion('alice', 'one', 'Changed reason', details.photoUrl)).toEqual({ id: log.id, status: 'pending', reason: details.reason });
    expect(mocks.tx.auditLog.create).not.toHaveBeenCalled();
  });

  it('uses a separate request identity for a replacement photo on the same submission', async () => {
    const replacement = 'https://example.test/replacement.jpg';
    expect(photoDeleteRequestId('one', replacement)).not.toBe(log.id);
    mocks.tx.eventSubmission.findUnique.mockResolvedValue({ id: 'one', userId: 'alice', eventId: details.eventId, attendanceImageUrl: replacement, event: { title: details.eventTitle } });
    const result = await requestEventPhotoDeletion('alice', 'one', details.reason, replacement);
    expect(result.id).toBe(photoDeleteRequestId('one', replacement));
  });

  it('limits a moderator list to their assigned barangay', async () => {
    await listEventPhotoDeletionRequests({ userId: 'mod', role: 'moderator', city: 'Yukos' }, 'pending', 2, 20);
    expect(mocks.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { action: PHOTO_DELETE_PENDING, user: { profile: { city: { equals: 'Yukos', mode: 'insensitive' } } } }, skip: 20, take: 20 }));
    expect(mocks.count).toHaveBeenCalledWith({ where: expect.objectContaining({ user: expect.anything() }) });
  });

  it('rejects users and moderators without an assigned barangay', async () => {
    for (const role of ['user', 'moderator']) {
      await expect(listEventPhotoDeletionRequests({ userId: 'x', role }, 'pending', 1, 20)).rejects.toMatchObject({ statusCode: 403 });
    }
    expect(mocks.findMany).not.toHaveBeenCalled();
  });

  it('clears only the requested photo and records approval, retaining the submission', async () => {
    await approveEventPhotoDeletion(admin, log.id);
    expect(mocks.tx.eventSubmission.updateMany).toHaveBeenCalledWith({ where: { id: 'one', userId: 'alice', attendanceImageUrl: details.photoUrl }, data: { attendanceImageUrl: '' } });
    const update = mocks.tx.auditLog.update.mock.calls[0][0];
    expect(update.data.action).toBe(PHOTO_DELETE_APPROVED);
    expect(JSON.parse(update.data.details)).toMatchObject({ ...details, reviewedById: 'admin' });
  });

  it('makes repeated approvals idempotent', async () => {
    mocks.tx.auditLog.findUnique.mockResolvedValue({ ...log, action: PHOTO_DELETE_APPROVED });
    expect(await approveEventPhotoDeletion(admin, log.id)).toMatchObject({ alreadyApproved: true });
    expect(mocks.tx.eventSubmission.updateMany).not.toHaveBeenCalled();
    expect(mocks.tx.auditLog.update).not.toHaveBeenCalled();
  });

  it('does not approve if the requested photo has been replaced', async () => {
    mocks.tx.eventSubmission.updateMany.mockResolvedValue({ count: 0 });
    await expect(approveEventPhotoDeletion(admin, log.id)).rejects.toMatchObject({ statusCode: 409 });
    expect(mocks.tx.auditLog.update).not.toHaveBeenCalled();
  });

  it('checks moderator scope during approval as well as listing', async () => {
    mocks.tx.auditLog.findFirst.mockResolvedValue(null);
    await expect(approveEventPhotoDeletion({ userId: 'mod', role: 'moderator', city: 'Yukos' }, log.id)).rejects.toMatchObject({ statusCode: 404 });
    expect(mocks.tx.auditLog.findFirst).toHaveBeenCalledWith({ where: expect.objectContaining({ user: { profile: { city: { equals: 'Yukos', mode: 'insensitive' } } } }) });
    expect(mocks.tx.eventSubmission.updateMany).not.toHaveBeenCalled();
  });

  it('keeps photo URLs out of approved history responses', async () => {
    mocks.findMany.mockResolvedValue([{ ...log, action: PHOTO_DELETE_APPROVED, timestamp: new Date(), user: null }]);
    const result = await listEventPhotoDeletionRequests(admin, 'approved', 1, 20);
    expect(result.items[0]).toMatchObject({ reason: details.reason, photoUrl: null, status: 'approved' });
  });
});
