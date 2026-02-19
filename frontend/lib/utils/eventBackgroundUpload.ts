/**
 * Upload event projector background images/videos to Supabase Storage.
 * Bucket: event-backgrounds (create in Dashboard if missing).
 */

import { createClient } from '@/lib/supabase/client';

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB
const ALLOWED_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
  'video/mp4',
  'video/webm',
];

export function validateEventBackgroundFile(file: File): { valid: boolean; error?: string } {
  if (!ALLOWED_TYPES.includes(file.type)) {
    return {
      valid: false,
      error: 'Invalid file type. Allowed: images (jpeg, png, webp, gif) and video (mp4, webm).',
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

export async function uploadEventBackgroundAsset(
  file: File,
  userId: string,
  eventId: string
): Promise<string> {
  const validation = validateEventBackgroundFile(file);
  if (!validation.valid) {
    throw new Error(validation.error ?? 'Invalid file');
  }

  const supabase = createClient();
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 9);
  const ext = file.name.split('.').pop() || 'bin';
  const filename = `${userId}/${eventId}/${timestamp}-${random}.${ext}`;

  const { error } = await supabase.storage
    .from('event-backgrounds')
    .upload(filename, file, { cacheControl: '3600', upsert: false });

  if (error) {
    throw new Error(`Upload failed: ${error.message}`);
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from('event-backgrounds').getPublicUrl(filename);
  if (!publicUrl) {
    throw new Error('Failed to get public URL');
  }
  return publicUrl;
}
