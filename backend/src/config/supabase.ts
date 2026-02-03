import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Check if Supabase is configured
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const isSupabaseConfigured = !!(supabaseUrl && supabaseServiceKey);

if (!isSupabaseConfigured) {
  console.warn('⚠️  Supabase not configured - using mock data mode');
  console.warn('   Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in backend/.env for real data');
} else {
  console.log('✅ Supabase configured and connected');
  console.log(`   URL: ${supabaseUrl?.substring(0, 30)}...`);
}

// Create Supabase client (or null if not configured)
export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(
      supabaseUrl!,
      supabaseServiceKey!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    )
  : null;

/**
 * Extract Supabase project reference from URL
 * e.g., "https://xxxx.supabase.co" -> "xxxx"
 */
export function getSupabaseProjectRef(): string | null {
  if (!supabaseUrl) {
    return null;
  }
  try {
    const url = new URL(supabaseUrl);
    const hostname = url.hostname;
    // Extract project ref from hostname (e.g., "xxxx.supabase.co" -> "xxxx")
    const match = hostname.match(/^([^.]+)\.supabase\.co$/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

/**
 * Get safe prefix of Supabase URL for logging (first 30 chars)
 */
export function getSupabaseUrlPrefix(): string {
  if (!supabaseUrl) {
    return '';
  }
  return supabaseUrl.substring(0, 30);
}

// Helper function to verify user authentication
export async function verifyUserToken(token: string): Promise<string | null> {
  if (!supabase) {
    console.warn('[Auth] Cannot verify token - Supabase not configured');
    return null;
  }

  try {
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data.user) {
      return null;
    }
    return data.user.id;
  } catch (error) {
    console.error('Error verifying user token:', error);
    return null;
  }
}
