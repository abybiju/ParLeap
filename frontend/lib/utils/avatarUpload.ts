import { createClient } from '@/lib/supabase/client'

const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB
const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']

/**
 * Validates that the file is a valid image file
 */
export function validateImageFile(file: File): { valid: boolean; error?: string } {
  // Check file type
  if (!ALLOWED_TYPES.includes(file.type)) {
    return {
      valid: false,
      error: `Invalid file type. Allowed types: ${ALLOWED_TYPES.join(', ')}`,
    }
  }

  // Check file size
  if (file.size > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `File size exceeds ${MAX_FILE_SIZE / (1024 * 1024)}MB limit`,
    }
  }

  return { valid: true }
}

/**
 * Uploads an avatar image to Supabase Storage
 * @param file - The image file to upload
 * @param userId - The user's ID
 * @returns The public URL of the uploaded avatar
 */
export async function uploadAvatarToStorage(
  file: File,
  userId: string
): Promise<string> {
  const supabase = createClient()

  // Validate file
  const validation = validateImageFile(file)
  if (!validation.valid) {
    throw new Error(validation.error || 'Invalid file')
  }

  // Generate unique filename
  const timestamp = Date.now()
  const random = Math.random().toString(36).substring(2, 9)
  const extension = file.name.split('.').pop() || 'png'
  const filename = `${userId}/${timestamp}-${random}.${extension}`

  // Upload to Supabase Storage
  const { data, error } = await supabase.storage
    .from('avatars')
    .upload(filename, file, {
      cacheControl: '3600',
      upsert: false, // Don't overwrite existing files
    })

  if (error) {
    throw new Error(`Failed to upload avatar: ${error.message}`)
  }

  // Get public URL
  const {
    data: { publicUrl },
  } = supabase.storage.from('avatars').getPublicUrl(filename)

  if (!publicUrl) {
    throw new Error('Failed to get public URL for uploaded avatar')
  }

  return publicUrl
}

/**
 * Resizes an image file if it exceeds the maximum dimensions
 * Note: This is a placeholder - actual implementation would require canvas manipulation
 * For now, we'll rely on client-side validation and let Supabase handle storage
 */
export async function resizeImageIfNeeded(
  file: File,
  maxWidth: number = 512,
  maxHeight: number = 512
): Promise<File> {
  // For now, return the file as-is
  // In production, you might want to use a library like 'browser-image-compression'
  // or implement canvas-based resizing
  return file
}
