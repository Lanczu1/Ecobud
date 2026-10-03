import { beforeEach, expect, it, vi } from 'vitest';
const { findMany, updateMany, remove } = vi.hoisted(() => ({ findMany: vi.fn(), updateMany: vi.fn(), remove: vi.fn() }));
vi.mock('../prismaClient', () => ({ prisma: { idVerificationSubmission: { findMany, updateMany } } }));
vi.mock('./idDocumentStorage', () => ({ idDocumentStorage: { remove } }));
import { cleanupReviewedIds } from './idDocumentCleanup';
beforeEach(() => { vi.clearAllMocks(); findMany.mockResolvedValue([{ id: 'reviewed', documentPath: 'private/photo' }]); remove.mockResolvedValue(undefined); });
it('deletes only reviewed photos older than 30 days while preserving review records', async () => {
  await cleanupReviewedIds();
  const query = findMany.mock.calls[0][0];
  expect(query.where.status.in).toEqual(['approved', 'rejected']);
  expect(Date.now() - query.where.reviewedAt.lt.getTime()).toBeGreaterThanOrEqual(30 * 86400000);
  expect(remove).toHaveBeenCalledWith('private/photo');
  expect(updateMany).toHaveBeenCalledWith({ where: { id: 'reviewed', documentPath: 'private/photo' }, data: { documentPath: null } });
});
it('keeps the cleanup pointer for retry if storage removal fails', async () => {
  remove.mockRejectedValue(new Error('unavailable'));
  const log = vi.spyOn(console, 'error').mockImplementation(() => {});
  await cleanupReviewedIds();
  expect(updateMany).not.toHaveBeenCalled(); log.mockRestore();
});
