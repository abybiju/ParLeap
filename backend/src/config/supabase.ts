import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Check if Supabase is configured
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const isSupabaseConfigured = !!(supabaseUrl && supabaseServiceKey);

if (!isSupabaseConfigured) {
  console.warn('⚠️  Supabase not configured - using mock data mode');
  console.warn('   Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in backend/.env for real data');
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
