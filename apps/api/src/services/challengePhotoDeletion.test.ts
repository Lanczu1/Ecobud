import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const tx = {
    $queryRaw: vi.fn(),
    challengeSubmission: { findUnique: vi.fn(), updateMany: vi.fn() },
    auditLog: { findUnique: vi.fn(), findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
  };
  return { tx, transaction: vi.fn(), findMany: vi.fn(), count: vi.fn() };
});
vi.mock('../prismaClient', () => ({ prisma: { $transaction: mocks.transaction, auditLog: { findMany: mocks.findMany, count: mocks.count } } }));
import { approveChallengePhotoDeletion, requestChallengePhotoDeletion, listChallengePhotoDeletionRequests, challengePhotoDeletionStatuses, challengePhotoRequestId, CHALLENGE_PHOTO_DELETE_PENDING, CHALLENGE_PHOTO_DELETE_APPROVED } from './challengePhotoDeletion';

const photoUrl = 'https://example.test/proof.jpg';
const details = { submissionId: 'one', eventId: 'cycle-one', eventTitle: 'Recycle bottles', photoField: 'proofUrl', photoUrl, reason: 'Please remove my photo' };
const log = { id: challengePhotoRequestId('one', 'proofUrl', photoUrl), userId: 'alice', action: CHALLENGE_PHOTO_DELETE_PENDING, details: JSON.stringify(details) };
const admin = { userId: 'admin', role: 'admin' };
const submission = { id: 'one', userId: 'alice', status: 'approved', rewardAwarded: false, challengeInstanceId: 'cycle-one', proofUrl: photoUrl, afterProofUrl: 'https://example.test/after.jpg', challengeInstance: { challenge: { title: details.eventTitle } } };

describe('challenge photo deletion', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.transaction.mockImplementation(callback => callback(mocks.tx));
    mocks.tx.$queryRaw.mockResolvedValue([{ id: 'one' }]);
    mocks.tx.challengeSubmission.findUnique.mockResolvedValue(submission);
    mocks.tx.challengeSubmission.updateMany.mockResolvedValue({ count: 1 });
    mocks.tx.auditLog.findUnique.mockResolvedValue(null);
    mocks.tx.auditLog.findFirst.mockResolvedValue(log);
    mocks.findMany.mockResolvedValue([]);
    mocks.count.mockResolvedValue(0);
  });

  it('records the exact approved proof photo, reason, and owner without deleting it', async () => {
    expect(await requestChallengePhotoDeletion('alice', 'one', 'proofUrl', details.reason, photoUrl)).toMatchObject({ id: log.id, status: 'pending' });
    const stored = mocks.tx.auditLog.create.mock.calls[0][0].data;
    expect(stored).toMatchObject({ id: log.id, userId: 'alice', action: CHALLENGE_PHOTO_DELETE_PENDING });
    expect(JSON.parse(stored.details)).toEqual(details);
    expect(mocks.tx.challengeSubmission.updateMany).not.toHaveBeenCalled();
  });

  it('keeps separate requests for proof and after photos, even when URLs match', () => {
    expect(challengePhotoRequestId('one', 'proofUrl', photoUrl)).not.toBe(challengePhotoRequestId('one', 'afterProofUrl', photoUrl));
  });

  it('does not allow another user to request deletion', async () => {
    await expect(requestChallengePhotoDeletion('bob', 'one', 'proofUrl', details.reason, photoUrl)).rejects.toMatchObject({ statusCode: 404 });
    expect(mocks.tx.auditLog.create).not.toHaveBeenCalled();
  });

  it('keeps photos needed for unfinished submissions', async () => {
    mocks.tx.challengeSubmission.findUnique.mockResolvedValue({ ...submission, status: 'approved_collection' });
    await expect(requestChallengePhotoDeletion('alice', 'one', 'proofUrl', details.reason, photoUrl)).rejects.toMatchObject({ statusCode: 409 });
    expect(mocks.tx.auditLog.create).not.toHaveBeenCalled();
  });

  it('rejects an outdated photo and deduplicates a pending request', async () => {
    await expect(requestChallengePhotoDeletion('alice', 'one', 'proofUrl', details.reason, 'old.jpg')).rejects.toMatchObject({ statusCode: 409 });
    mocks.tx.auditLog.findUnique.mockResolvedValue(log);
    expect(await requestChallengePhotoDeletion('alice', 'one', 'proofUrl', 'Different reason', photoUrl)).toMatchObject({ reason: details.reason, id: log.id });
    expect(mocks.tx.auditLog.create).not.toHaveBeenCalled();
  });

  it.each(['proofUrl', 'afterProofUrl'] as const)('approval clears only %s and retains all submission/reward data', async field => {
    mocks.tx.auditLog.findFirst.mockResolvedValue({ ...log, details: JSON.stringify({ ...details, photoField: field }) });
    await approveChallengePhotoDeletion(admin, log.id);
    expect(mocks.tx.challengeSubmission.updateMany).toHaveBeenCalledWith({
      where: { id: 'one', userId: 'alice', [field]: photoUrl, OR: [{ status: 'approved' }, { rewardAwarded: true }] }, data: { [field]: null },
    });
    const audit = mocks.tx.auditLog.update.mock.calls[0][0];
    expect(audit.data.action).toBe(CHALLENGE_PHOTO_DELETE_APPROVED);
    expect(JSON.parse(audit.data.details)).toMatchObject({ photoField: field, reason: details.reason, reviewedById: 'admin' });
  });

  it('does not approve if the photo changed or the submission was reopened', async () => {
    mocks.tx.challengeSubmission.updateMany.mockResolvedValue({ count: 0 });
    await expect(approveChallengePhotoDeletion(admin, log.id)).rejects.toMatchObject({ statusCode: 409 });
    expect(mocks.tx.auditLog.update).not.toHaveBeenCalled();
  });

  it('makes repeated approvals idempotent', async () => {
    mocks.tx.auditLog.findUnique.mockResolvedValue({ ...log, action: CHALLENGE_PHOTO_DELETE_APPROVED });
    expect(await approveChallengePhotoDeletion(admin, log.id)).toMatchObject({ alreadyApproved: true });
    expect(mocks.tx.challengeSubmission.updateMany).not.toHaveBeenCalled();
  });

  it('limits moderator listing and approval to the assigned barangay', async () => {
    const mod = { userId: 'mod', role: 'moderator', city: 'Yukos' };
    await listChallengePhotoDeletionRequests(mod, 'pending', 1, 20);
    expect(mocks.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { action: CHALLENGE_PHOTO_DELETE_PENDING, user: { profile: { city: { equals: 'Yukos', mode: 'insensitive' } } } } }));
    mocks.tx.auditLog.findFirst.mockResolvedValue(null);
    await expect(approveChallengePhotoDeletion(mod, log.id)).rejects.toMatchObject({ statusCode: 404 });
    expect(mocks.tx.auditLog.findFirst).toHaveBeenCalledWith({ where: expect.objectContaining({ user: { profile: { city: { equals: 'Yukos', mode: 'insensitive' } } } }) });
  });

  it('isolates challenge requests from event requests and regular users', async () => {
    await expect(listChallengePhotoDeletionRequests({ userId: 'alice', role: 'user' }, 'pending', 1, 20)).rejects.toMatchObject({ statusCode: 403 });
    await listChallengePhotoDeletionRequests(admin, 'approved', 1, 20);
    expect(mocks.count).toHaveBeenCalledWith({ where: { action: CHALLENGE_PHOTO_DELETE_APPROVED } });
  });

  it('returns per-photo statuses for the owner after approval without losing history', async () => {
    mocks.findMany.mockResolvedValue([{ ...log, action: CHALLENGE_PHOTO_DELETE_APPROVED }]);
    const states = await challengePhotoDeletionStatuses('alice', [{ id: 'one', proofUrl: null, afterProofUrl: submission.afterProofUrl }]);
    expect(states.get('one')).toEqual({ proofUrl: { id: log.id, status: 'approved', reason: details.reason } });
    expect(mocks.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ userId: 'alice' }) }));
  });
});
