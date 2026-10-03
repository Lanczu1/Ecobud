import { prisma } from '../prismaClient';
import { idDocumentStorage } from './idDocumentStorage';

export async function cleanupReviewedIds() {
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const rows = await prisma.idVerificationSubmission.findMany({
    where: { documentPath: { not: null }, status: { in: ['approved', 'rejected'] }, reviewedAt: { lt: cutoff } },
    select: { id: true, documentPath: true }, take: 100,
  });
  for (const row of rows) {
    if (!row.documentPath) continue;
    try {
      await idDocumentStorage.remove(row.documentPath);
      await prisma.idVerificationSubmission.updateMany({ where: { id: row.id, documentPath: row.documentPath }, data: { documentPath: null } });
    } catch { console.error('Reviewed ID photo cleanup will be retried.'); }
  }
}

let timer: NodeJS.Timeout | undefined;
let running = false;
export function startIdDocumentCleanup() {
  if (timer) return;
  const tick = async () => {
    if (running) return;
    running = true;
    try { await cleanupReviewedIds(); }
    catch { console.error('ID retention cleanup is unavailable.'); }
    finally { running = false; }
  };
  void tick();
  timer = setInterval(() => void tick(), 60 * 60 * 1000);
  timer.unref();
}
export function stopIdDocumentCleanup() { if (timer) clearInterval(timer); timer = undefined; }
