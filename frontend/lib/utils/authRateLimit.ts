const STORAGE_KEY = 'parleap_auth_attempts';
const MAX_ATTEMPTS = 5;
const LOCKOUT_DURATIONS_MS = [30_000, 60_000, 300_000]; // 30s, 1m, 5m

interface AuthAttemptState {
  attempts: number;
  lockoutUntil: number | null;
  lockoutLevel: number;
  lastAttemptAt: number;
}

function getState(): AuthAttemptState {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      // Reset if last attempt was over 15 minutes ago
      if (parsed.lastAttemptAt && Date.now() - parsed.lastAttemptAt > 15 * 60 * 1000) {
        return { attempts: 0, lockoutUntil: null, lockoutLevel: 0, lastAttemptAt: 0 };
      }
      return parsed;
    }
  } catch { /* ignore */ }
  return { attempts: 0, lockoutUntil: null, lockoutLevel: 0, lastAttemptAt: 0 };
}

function setState(state: AuthAttemptState): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch { /* ignore */ }
}

export function checkAuthRateLimit(): { allowed: boolean; retryAfterSeconds: number } {
  const state = getState();

  if (state.lockoutUntil) {
    const remaining = state.lockoutUntil - Date.now();
    if (remaining > 0) {
      return { allowed: false, retryAfterSeconds: Math.ceil(remaining / 1000) };
    }
    // Lockout expired — reset attempts but keep lockout level
    state.lockoutUntil = null;
    state.attempts = 0;
    setState(state);
  }

  return { allowed: true, retryAfterSeconds: 0 };
}

export function recordAuthFailure(): void {
  const state = getState();
  state.attempts += 1;
  state.lastAttemptAt = Date.now();

  if (state.attempts >= MAX_ATTEMPTS) {
    const level = Math.min(state.lockoutLevel, LOCKOUT_DURATIONS_MS.length - 1);
    state.lockoutUntil = Date.now() + LOCKOUT_DURATIONS_MS[level];
    state.lockoutLevel = level + 1;
    state.attempts = 0;
  }

  setState(state);
}

export function resetAuthRateLimit(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch { /* ignore */ }
}
