import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import path from 'path';

const files = vi.hoisted(() => ({ readFile: vi.fn(), stat: vi.fn() }));
vi.mock('fs/promises', () => files);
import { readEventReportPhoto } from './eventReportPhoto';

const storageOrigin = 'https://project.supabase.co';
const photo = `${storageOrigin}/storage/v1/object/public/ecobud-media/events/submissions/photo.jpg`;
const fetchMock = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('SUPABASE_URL', storageOrigin);
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe('event report photo loading', () => {
  it('loads approved Supabase photo bytes for PDF embedding using the full storage URL', async () => {
    fetchMock.mockResolvedValue(new Response(new Uint8Array([255, 216, 255])));
    expect(await readEventReportPhoto(photo, '/uploads')).toEqual(Buffer.from([255, 216, 255]));
    expect(fetchMock.mock.calls[0][0].href).toBe(photo);
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ redirect: 'error', signal: expect.any(AbortSignal) });
    expect(files.readFile).not.toHaveBeenCalled();
  });

  it('preserves legacy local attendance photos', async () => {
    files.stat.mockResolvedValue({ size: 3 });
    files.readFile.mockResolvedValue(Buffer.from([1, 2, 3]));
    expect(await readEventReportPhoto('/uploads/EventSubmissions/old.jpg', '/uploads')).toEqual(Buffer.from([1, 2, 3]));
    expect(files.readFile).toHaveBeenCalledWith(path.join('/uploads', 'EventSubmissions', 'old.jpg'));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('does not fetch unrelated hosts or storage paths', async () => {
    for (const url of ['http://127.0.0.1/photo.jpg', 'https://other.supabase.co/photo.jpg', `${storageOrigin}/rest/v1/users`]) {
      expect(await readEventReportPhoto(url, '/uploads')).toBeNull();
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('handles missing photos and stops an oversized response without trusting its size header', async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 404 }));
    expect(await readEventReportPhoto(photo, '/uploads')).toBeNull();
    fetchMock.mockResolvedValueOnce(new Response(new Uint8Array(5 * 1024 * 1024 + 1)));
    expect(await readEventReportPhoto(photo, '/uploads')).toBeNull();
  });
});
