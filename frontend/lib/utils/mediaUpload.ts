/**
 * Upload media (images/videos) for setlist MEDIA items to Supabase Storage.
 * Bucket: media-assets (create in Dashboard if missing).
 */

import { createClient } from '@/lib/supabase/client';

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB for video
const ALLOWED_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
  'video/mp4',
  'video/webm',
];

export function validateMediaFile(file: File): { valid: boolean; error?: string } {
  if (!ALLOWED_TYPES.includes(file.type)) {
    return {
      valid: false,
      error: `Invalid file type. Allowed: images and video (mp4, webm).`,
    };
  }
  if (file.size > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `File size exceeds ${MAX_FILE_SIZE / (1024 * 1024)}MB limit`,
    };
  }
  return { valid: true };
}

export function validateMediaBlob(blob: Blob, _name: string): { valid: boolean; error?: string } {
  const type = blob.type;
  const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/webm'];
  if (!allowed.some((t) => type.startsWith(t.split('/')[0]!))) {
    return { valid: false, error: 'Invalid file type. Use images or video (mp4, webm).' };
  }
  if (blob.size > MAX_FILE_SIZE) {
    return { valid: false, error: `File size exceeds ${MAX_FILE_SIZE / (1024 * 1024)}MB limit` };
  }
  return { valid: true };
}

export async function uploadMediaAsset(
  file: File | Blob,
  userId: string,
  fileName?: string
): Promise<string> {
  const fileObj = file instanceof File ? file : new File([file], fileName ?? 'media', { type: file.type });
  const validation = validateMediaFile(fileObj);
  if (!validation.valid) {
    throw new Error(validation.error ?? 'Invalid file');
  }

  const supabase = createClient();
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 9);
  const ext = fileObj.name.split('.').pop() || 'bin';
  const filename = `${userId}/${timestamp}-${random}.${ext}`;

  const { error } = await supabase.storage
    .from('media-assets')
    .upload(filename, fileObj, { cacheControl: '3600', upsert: false });

  if (error) {
    const msg = error.message?.toLowerCase() ?? '';
    if (msg.includes('bucket') && (msg.includes('not found') || msg.includes('missing'))) {
      throw new Error(
        "Storage bucket 'media-assets' not found. Create it in Supabase: Dashboard → Storage → New bucket → name 'media-assets', set to Public."
      );
    }
    throw new Error(`Upload failed: ${error.message}`);
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from('media-assets').getPublicUrl(filename);
  if (!publicUrl) {
    throw new Error('Failed to get public URL');
  }
  return publicUrl;
}

/**
 * Parse a Google Drive share link and return a direct download URL.
 * Supports: drive.google.com/file/d/FILE_ID/view and drive.google.com/open?id=FILE_ID
 */
export function parseGoogleDriveLink(link: string): string | null {
  const trimmed = link.trim();
  const fileIdMatch =
    /(?:drive\.google\.com\/file\/d\/|drive\.google\.com\/open\?id=)([a-zA-Z0-9_-]+)/.exec(
      trimmed
    );
  if (!fileIdMatch?.[1]) return null;
  return `https://drive.google.com/uc?export=download&id=${fileIdMatch[1]}`;
}
