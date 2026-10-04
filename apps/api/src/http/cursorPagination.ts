import { HttpError } from './errorResponder';

export type PageCursor = { id: string; at: string; featured?: boolean };

export function encodeCursor(cursor: PageCursor): string {
  return Buffer.from(JSON.stringify(cursor)).toString('base64url');
}

export function decodeCursor(value: unknown): PageCursor | undefined {
  if (value === undefined) return undefined;
  try {
    if (typeof value !== 'string' || value.length > 512 || !/^[\w-]+$/.test(value)) throw new Error();
    const cursor = JSON.parse(Buffer.from(value, 'base64url').toString());
    if (typeof cursor.id !== 'string' || !cursor.id || cursor.id.length > 128 ||
        typeof cursor.at !== 'string' || !Number.isFinite(Date.parse(cursor.at)) ||
        (cursor.featured !== undefined && typeof cursor.featured !== 'boolean')) throw new Error();
    return cursor;
  } catch {
    throw new HttpError(400, 'Invalid page cursor.');
  }
}

export function pageLimit(value: unknown, fallback = 40): number {
  if (value === undefined) return fallback;
  if (typeof value !== 'string' || !/^\d+$/.test(value) || Number(value) < 1 || Number(value) > 50) {
    throw new HttpError(400, 'Page size must be between 1 and 50.');
  }
  return Number(value);
}
