import { prisma } from '../prismaClient';
import { idDocumentStorage } from './idDocumentStorage';

export async function removeReviewedIdPhoto(id: string, documentPath: string) {
  await idDocumentStorage.remove(documentPath);
  await prisma.idVerificationSubmission.updateMany({ where: { id, documentPath }, data: { documentPath: null } });
}

export async function cleanupReviewedIds() {
  const rows = await prisma.idVerificationSubmission.findMany({
    where: { documentPath: { not: null }, status: { in: ['approved', 'rejected'] } },
    select: { id: true, documentPath: true }, take: 100,
  });
  for (const row of rows) {
    if (!row.documentPath) continue;
    try { await removeReviewedIdPhoto(row.id, row.documentPath); }
    catch { console.error('Reviewed ID photo cleanup will be retried.'); }
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
