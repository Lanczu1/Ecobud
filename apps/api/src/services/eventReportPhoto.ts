import { readFile, stat } from 'fs/promises';
import path from 'path';

const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const STORAGE_PUBLIC_PATH = '/storage/v1/object/public/ecobud-media/';

export interface ReportPhotoSource {
  localDir: string;
  storageFolder: string;
}

export const EVENT_SUBMISSION_PHOTOS: ReportPhotoSource = { localDir: 'EventSubmissions', storageFolder: 'events/submissions/' };
export const CHALLENGE_SUBMISSION_PHOTOS: ReportPhotoSource = { localDir: 'Challenges', storageFolder: 'challenges/' };

export async function readEventReportPhoto(photoUrl: string, uploadsBase: string): Promise<Buffer | null> {
  return readReportPhoto(photoUrl, uploadsBase, EVENT_SUBMISSION_PHOTOS);
}

// Reads a submission photo from local uploads or our own Supabase bucket only, capped at 5 MB.
export async function readReportPhoto(photoUrl: string, uploadsBase: string, source: ReportPhotoSource): Promise<Buffer | null> {
  if (!/^https?:\/\//i.test(photoUrl)) {
    const filename = path.basename(photoUrl.split('?')[0]);
    if (!filename || filename === '.' || filename === '..') return null;
    const filePath = path.join(uploadsBase, source.localDir, filename);
    if ((await stat(filePath)).size > MAX_PHOTO_BYTES) return null;
    return readFile(filePath);
  }

  const url = new URL(photoUrl);
  const storageOrigin = process.env.SUPABASE_URL ? new URL(process.env.SUPABASE_URL).origin : null;
  if (url.protocol !== 'https:' || url.origin !== storageOrigin || url.username || url.password ||
      !url.pathname.startsWith(STORAGE_PUBLIC_PATH + source.storageFolder) || url.pathname.includes('..')) return null;
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
