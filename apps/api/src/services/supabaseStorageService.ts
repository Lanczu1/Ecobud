import { createClient, SupabaseClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const trimValue = (value?: string | null) => {
  if (value === undefined || value === null) return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

class SupabaseStorageService {
  private client: SupabaseClient | null = null;
  private bucketName: string = 'ecobud-media';
  private bucketReady: Promise<void> | null = null;

  constructor() {
    const url = trimValue(process.env.SUPABASE_URL);
    const serviceRoleKey = trimValue(process.env.SUPABASE_SERVICE_ROLE_KEY);

    if (url && serviceRoleKey) {
      this.client = createClient(url, serviceRoleKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      });
      this.bucketReady = this.ensureBucketExists();
    } else {
      console.warn('[SupabaseStorage] SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing. Storage will be disabled.');
    }
  }

  private async ensureBucketExists() {
    if (!this.client) return;
    try {
      const { data: buckets, error } = await this.client.storage.listBuckets();
      if (error) {
        console.error('[SupabaseStorage] Failed to list buckets:', error.message);
        return;
      }

      const exists = buckets?.some((b) => b.name === this.bucketName);
      if (!exists) {
        const { error: createError } = await this.client.storage.createBucket(this.bucketName, {
          public: true,
          fileSizeLimit: 104857600, // 100MB
        });
        if (createError) {
          console.error('[SupabaseStorage] Failed to create public bucket:', createError.message);
        } else {
          console.log(`[SupabaseStorage] Bucket "${this.bucketName}" created successfully with public access.`);
        }
      }
    } catch (e) {
      console.error('[SupabaseStorage] Unexpected error checking bucket:', e);
    }
  }

  /**
   * Upload a file buffer or file from disk to Supabase Storage
   * @param destinationPath e.g., 'avatars/avatar-12345.jpg'
   * @param fileSource Buffer or local file path string
   * @param contentType e.g., 'image/jpeg' or 'video/mp4'
   * @returns Public URL of the uploaded file
   */
  async uploadFile(
    destinationPath: string,
    fileSource: Buffer | string,
    contentType?: string
  ): Promise<string> {
    if (!this.client) {
      throw new Error('Supabase client is not configured.');
    }

    if (this.bucketReady) {
      await this.bucketReady.catch(() => {});
    }

    let fileBody: Buffer;
    if (typeof fileSource === 'string') {
      fileBody = fs.readFileSync(fileSource);
    } else {
      fileBody = fileSource;
    }

    // Clean destination path (remove leading slash)
    const cleanPath = destinationPath.replace(/^\/+/, '');

    const { data, error } = await this.client.storage
      .from(this.bucketName)
      .upload(cleanPath, fileBody, {
        contentType: contentType || 'application/octet-stream',
        upsert: true,
      });

    if (error) {
      console.error('[SupabaseStorage] Upload error:', error);
      throw new Error(`Failed to upload to Supabase: ${error.message}`);
    }

    const { data: publicUrlData } = this.client.storage
      .from(this.bucketName)
      .getPublicUrl(data.path);

    return publicUrlData.publicUrl;
  }

  /**
   * Delete a file or list of files from Supabase Storage
   * @param fileUrlOrPath Supabase public URL or internal storage path
   */
  async deleteFile(fileUrlOrPath: string): Promise<boolean> {
    if (!this.client || !fileUrlOrPath) return false;

    try {
      let pathToDelete = fileUrlOrPath;

      // If full URL is provided, extract the path relative to the bucket
      if (fileUrlOrPath.startsWith('http://') || fileUrlOrPath.startsWith('https://')) {
        const bucketMarker = `/${this.bucketName}/`;
        const index = fileUrlOrPath.indexOf(bucketMarker);
        if (index !== -1) {
          pathToDelete = decodeURIComponent(fileUrlOrPath.substring(index + bucketMarker.length));
        } else {
          // Might not be a Supabase URL in our bucket
          return false;
        }
      }

      pathToDelete = pathToDelete.replace(/^\/+/, '');

      const { error } = await this.client.storage
        .from(this.bucketName)
        .remove([pathToDelete]);

      if (error) {
        console.error('[SupabaseStorage] Delete error:', error.message);
        return false;
      }

      return true;
    } catch (e) {
      console.error('[SupabaseStorage] Unexpected error during delete:', e);
      return false;
    }
  }
}

export const supabaseStorageService = new SupabaseStorageService();
