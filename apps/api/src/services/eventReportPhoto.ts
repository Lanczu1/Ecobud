import { readFile, stat } from 'fs/promises';
import path from 'path';

const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

export async function readEventReportPhoto(photoUrl: string, uploadsBase: string): Promise<Buffer | null> {
  if (!/^https?:\/\//i.test(photoUrl)) {
    const filename = path.basename(photoUrl.split('?')[0]);
    if (!filename || filename === '.' || filename === '..') return null;
    const filePath = path.join(uploadsBase, 'EventSubmissions', filename);
    if ((await stat(filePath)).size > MAX_PHOTO_BYTES) return null;
    return readFile(filePath);
  }

  const url = new URL(photoUrl);
  const storageOrigin = process.env.SUPABASE_URL ? new URL(process.env.SUPABASE_URL).origin : null;
  if (url.protocol !== 'https:' || url.origin !== storageOrigin || url.username || url.password ||
      !url.pathname.startsWith('/storage/v1/object/public/ecobud-media/events/submissions/')) return null;
  const response = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(8000) });
  if (!response.ok || !response.body || Number(response.headers.get('content-length')) > MAX_PHOTO_BYTES) return null;
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      total += value.length;
      if (total > MAX_PHOTO_BYTES) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
    return Buffer.concat(chunks);
  } finally {
    reader.releaseLock();
  }
}
