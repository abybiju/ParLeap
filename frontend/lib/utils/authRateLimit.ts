const STORAGE_KEY = 'parleap_auth_attempts';

export function checkAuthRateLimit(): { allowed: boolean; retryAfterSeconds: number } {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch { /* ignore */ }
  return { allowed: true, retryAfterSeconds: 0 };
}

export function recordAuthFailure(): void {
  // no-op: client-side lockout disabled; backend rate limiting still applies
}

export function resetAuthRateLimit(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch { /* ignore */ }
}
