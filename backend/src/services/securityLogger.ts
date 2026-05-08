type SecurityEventType =
  | 'AUTH_SUCCESS'
  | 'AUTH_FAILURE'
  | 'WS_AUTH_SUCCESS'
  | 'WS_AUTH_FAILURE'
  | 'RATE_LIMIT_HIT'
  | 'API_ERROR'
  | 'SUSPICIOUS_TRAFFIC'
  | 'HTTPS_REDIRECT';

interface SecurityEvent {
  timestamp: string;
  type: SecurityEventType;
  ip: string;
  userId?: string;
  method?: string;
  path?: string;
  statusCode?: number;
  message?: string;
  meta?: Record<string, unknown>;
}

function emit(event: SecurityEvent): void {
  console.log(`[SECURITY] ${JSON.stringify(event)}`);
}

export function logAuthSuccess(ip: string, userId: string, path: string): void {
  emit({ timestamp: new Date().toISOString(), type: 'AUTH_SUCCESS', ip, userId, path });
}

export function logAuthFailure(ip: string, path: string, reason: string): void {
  emit({ timestamp: new Date().toISOString(), type: 'AUTH_FAILURE', ip, path, message: reason });
  trackAuthFailure(ip);
}

export function logWsAuthSuccess(ip: string, userId: string): void {
  emit({ timestamp: new Date().toISOString(), type: 'WS_AUTH_SUCCESS', ip, userId });
}

export function logWsAuthFailure(ip: string, reason: string): void {
  emit({ timestamp: new Date().toISOString(), type: 'WS_AUTH_FAILURE', ip, message: reason });
  trackAuthFailure(ip);
}

export function logRateLimitHit(ip: string, method: string, path: string): void {
  emit({ timestamp: new Date().toISOString(), type: 'RATE_LIMIT_HIT', ip, method, path });
}

export function logApiError(ip: string, method: string, path: string, statusCode: number, error: string): void {
  emit({ timestamp: new Date().toISOString(), type: 'API_ERROR', ip, method, path, statusCode, message: error });
}

export function logSuspiciousTraffic(ip: string, reason: string, meta?: Record<string, unknown>): void {
  emit({ timestamp: new Date().toISOString(), type: 'SUSPICIOUS_TRAFFIC', ip, message: reason, meta });
}

// ── Suspicious traffic detection ─────────────────────────────────────────

const AUTH_FAILURE_WINDOW_MS = 5 * 60 * 1000; // 5 minutes
const AUTH_FAILURE_THRESHOLD = 10;

interface FailureWindow {
  timestamps: number[];
}

const authFailures = new Map<string, FailureWindow>();

function trackAuthFailure(ip: string): void {
  const now = Date.now();
  const window = authFailures.get(ip) ?? { timestamps: [] };
  window.timestamps = window.timestamps.filter((t) => now - t < AUTH_FAILURE_WINDOW_MS);
  window.timestamps.push(now);
  authFailures.set(ip, window);

  if (window.timestamps.length >= AUTH_FAILURE_THRESHOLD) {
    logSuspiciousTraffic(ip, `${window.timestamps.length} auth failures in ${AUTH_FAILURE_WINDOW_MS / 1000}s window`, {
      failureCount: window.timestamps.length,
      windowMs: AUTH_FAILURE_WINDOW_MS,
    });
  }
}

// Periodic cleanup of stale entries (every 10 minutes)
setInterval(() => {
  const now = Date.now();
  for (const [ip, window] of authFailures) {
    window.timestamps = window.timestamps.filter((t) => now - t < AUTH_FAILURE_WINDOW_MS);
    if (window.timestamps.length === 0) authFailures.delete(ip);
  }
}, 10 * 60 * 1000).unref();
