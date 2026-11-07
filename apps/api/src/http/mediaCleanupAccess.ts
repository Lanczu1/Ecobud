import path from 'path';
import { HttpError } from './errorResponder';
import type { TokenSession } from '../security/tokenService';

function parseMediaObjectPath(value: string, supabaseUrl = process.env.SUPABASE_URL): string {
  let objectPath: string;
  if (/^https?:\/\//i.test(value)) {
    if (!supabaseUrl) throw new HttpError(400, 'Media storage is unavailable.');
    const url = new URL(value);
    const prefix = '/storage/v1/object/public/ecobud-media/';
    if (url.origin !== new URL(supabaseUrl).origin || !url.pathname.startsWith(prefix) || url.search || url.hash) {
      throw new HttpError(400, 'Invalid media URL.');
    }
    objectPath = decodeURIComponent(url.pathname.slice(prefix.length));
  } else {
    if (!value.startsWith('/uploads/')) throw new HttpError(400, 'Invalid media path.');
    objectPath = decodeURIComponent(value.slice('/uploads/'.length));
  }
  if (!objectPath || objectPath.includes('\\') || /[%\x00-\x1f\x7f:]/.test(objectPath)
    || objectPath.split('/').some(part => !part || part === '.' || part === '..')) {
    throw new HttpError(400, 'Invalid media path.');
  }
  return objectPath;
}

export function mediaObjectPath(value: string, supabaseUrl = process.env.SUPABASE_URL): string {
  try { return parseMediaObjectPath(value, supabaseUrl); }
  catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(400, 'Invalid media path.');
  }
}

export function authorizeMediaCleanup(value: string, actor: TokenSession): string {
  const objectPath = mediaObjectPath(value);
  if (actor.role !== 'admin' && !(actor.role === 'moderator' && objectPath.startsWith(`challenges/drafts/${actor.userId}/`))) {
    throw new HttpError(403, 'You can only remove your own draft uploads.');
  }
  return objectPath;
}

export function localUploadPath(value: string, root: string): string {
  const objectPath = mediaObjectPath(value);
  const resolved = path.resolve(root, objectPath);
  if (!resolved.startsWith(path.resolve(root) + path.sep)) throw new HttpError(400, 'Invalid media path.');
  return resolved;
}
