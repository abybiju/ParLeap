import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Lazy-initialized Supabase client.
// Reads process.env at first access so dotenv can load before the check runs
// (fixes "Supabase not configured" false alarm in scripts that call dotenv.config after imports).
let _supabase: SupabaseClient | null | undefined;
let _isConfigured: boolean | undefined;
let _supabaseUrl: string | undefined;

function ensureInit(): void {
  if (_isConfigured !== undefined) return;

  _supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  _isConfigured = !!(_supabaseUrl && supabaseServiceKey);

  if (!_isConfigured) {
    console.warn('⚠️  Supabase not configured - using mock data mode');
    console.warn('   Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in backend/.env for real data');
    _supabase = null;
  } else {
    console.log('✅ Supabase configured and connected');
    console.log(`   URL: ${_supabaseUrl?.substring(0, 30)}...`);
    _supabase = createClient(
      _supabaseUrl!,
      supabaseServiceKey!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );
  }
}

/** Whether Supabase credentials are present in the environment. */
export function isSupabaseConfigured(): boolean {
  ensureInit();
  return _isConfigured!;
}

/** Lazy Supabase client (null when not configured). */
export function getSupabaseClient(): SupabaseClient | null {
  ensureInit();
  return _supabase ?? null;
}

/**
 * Extract Supabase project reference from URL
 * e.g., "https://xxxx.supabase.co" -> "xxxx"
 */
export function getSupabaseProjectRef(): string | null {
  ensureInit();
  if (!_supabaseUrl) {
    return null;
  }
  try {
    const url = new URL(_supabaseUrl);
    const hostname = url.hostname;
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
  ensureInit();
  if (!_supabaseUrl) {
    return '';
  }
  return _supabaseUrl.substring(0, 30);
}

// Helper function to verify user authentication
export async function verifyUserToken(token: string): Promise<string | null> {
  const supabase = getSupabaseClient();
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
