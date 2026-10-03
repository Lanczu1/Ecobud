import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { readFile } from 'fs/promises';
import { HttpError } from '../http/errorResponder';

const bucket = 'ecobud-private-ids';
let client: SupabaseClient | undefined;
let ready: Promise<void> | undefined;

async function storage() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new HttpError(503, 'ID uploads are unavailable. Please try again later.');
  }
  client ??= createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  ready ??= (async () => {
    let { data, error } = await client!.storage.getBucket(bucket);
    if (error) {
      await client!.storage.createBucket(bucket, { public: false, fileSizeLimit: 5 * 1024 * 1024, allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'] });
      ({ data, error } = await client!.storage.getBucket(bucket));
    }
    if (error || !data || data.public) throw new HttpError(503, 'Private ID storage is unavailable. Please contact support.');
  })().catch(error => { ready = undefined; throw error; });
  await ready;
  return client.storage.from(bucket);
}

export const idDocumentStorage = {
  async upload(key: string, filePath: string, mime: string) {
    const { error } = await (await storage()).upload(key, await readFile(filePath), { contentType: mime, upsert: false });
    if (error) throw new HttpError(503, 'Your ID photo could not be saved. Please try again.');
  },
  async download(key: string) {
    const { data, error } = await (await storage()).download(key);
    if (error || !data) throw new HttpError(503, 'The ID photo could not be loaded. Please try again.');
    return { bytes: Buffer.from(await data.arrayBuffer()), mime: data.type };
  },
  async remove(key: string) {
    const { error } = await (await storage()).remove([key]);
    if (error) throw new Error('Private ID photo cleanup failed.');
  },
};
