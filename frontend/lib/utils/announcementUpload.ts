/**
 * Upload announcement slide images/videos to Supabase Storage.
 * Bucket: announcement-assets (create in Dashboard if missing).
 */

import { createClient } from '@/lib/supabase/client';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
  'video/mp4',
  'video/webm',
];

export function validateAnnouncementFile(file: File): { valid: boolean; error?: string } {
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

export async function uploadAnnouncementAsset(
  file: File,
  userId: string
): Promise<string> {
  const validation = validateAnnouncementFile(file);
  if (!validation.valid) {
    throw new Error(validation.error ?? 'Invalid file');
  }

  const supabase = createClient();
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 9);
  const ext = file.name.split('.').pop() || 'bin';
  const filename = `${userId}/${timestamp}-${random}.${ext}`;

  const { error } = await supabase.storage
    .from('announcement-assets')
    .upload(filename, file, { cacheControl: '3600', upsert: false });

  if (error) {
    throw new Error(`Upload failed: ${error.message}`);
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from('announcement-assets').getPublicUrl(filename);
  if (!publicUrl) {
    throw new Error('Failed to get public URL');
  }
  return publicUrl;
}
