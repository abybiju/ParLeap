import type { Request, Response, NextFunction } from 'express';
import { logRateLimitHit, logSuspiciousTraffic } from './securityLogger';

// ── Sliding-window counter ──────────────────────────────────────────────

interface BucketState {
  windowStart: number;
  count: number;
}

interface RateLimitConfig {
  windowMs: number;
  max: number;
}

const buckets = new Map<string, BucketState>();

function check(key: string, config: RateLimitConfig): { limited: boolean; remaining: number; retryAfterMs: number } {
  const now = Date.now();
  const state = buckets.get(key) ?? { windowStart: now, count: 0 };

  if (now - state.windowStart > config.windowMs) {
    state.windowStart = now;
    state.count = 0;
  }

  state.count += 1;
  buckets.set(key, state);

  const limited = state.count > config.max;
  const remaining = Math.max(0, config.max - state.count);
  const retryAfterMs = limited ? config.windowMs - (now - state.windowStart) : 0;

  return { limited, remaining, retryAfterMs };
}

// Periodic cleanup (every 5 minutes)
setInterval(() => {
  const now = Date.now();
  for (const [key, state] of buckets) {
    if (now - state.windowStart > 10 * 60 * 1000) buckets.delete(key);
  }
}, 5 * 60 * 1000).unref();

// ── Tier definitions ────────────────────────────────────────────────────

const TIERS = {
  global: { windowMs: 60_000, max: 120 },
  ai: { windowMs: 60_000, max: 10 },
  auth: { windowMs: 300_000, max: 20 },
  templates: { windowMs: 60_000, max: 30 },
  wsConnect: { windowMs: 60_000, max: 10 },
} as const;

function envOverride(envKey: string, fallback: number): number {
  const v = Number(process.env[envKey]);
  return Number.isFinite(v) ? v : fallback;
}

const globalConfig: RateLimitConfig = {
  windowMs: envOverride('HTTP_RATE_LIMIT_WINDOW_MS', TIERS.global.windowMs),
  max: envOverride('HTTP_RATE_LIMIT_MAX', TIERS.global.max),
};

// ── Helpers to extract client IP ────────────────────────────────────────

export function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') return forwarded.split(',')[0]?.trim() || 'unknown';
  if (Array.isArray(forwarded)) return forwarded[0] || 'unknown';
  return req.socket.remoteAddress || 'unknown';
}

// ── Express middleware factories ────────────────────────────────────────

function sendLimited(res: Response, retryAfterMs: number): void {
  res.setHeader('Retry-After', String(Math.ceil(retryAfterMs / 1000)));
  res.status(429).json({ error: 'Too many requests. Please try again later.' });
}

export function globalRateLimit(req: Request, res: Response, next: NextFunction): void {
  const ip = getClientIp(req);
  const result = check(`global:${ip}`, globalConfig);
  if (result.limited) {
    logRateLimitHit(ip, req.method, req.url);
    sendLimited(res, result.retryAfterMs);
    return;
  }
  next();
}

export function aiRateLimit(req: Request, res: Response, next: NextFunction): void {
  const ip = getClientIp(req);
  const result = check(`ai:${ip}`, TIERS.ai);
  if (result.limited) {
    logRateLimitHit(ip, req.method, req.url);
    logSuspiciousTraffic(ip, 'AI endpoint rate limit exceeded', { path: req.url, tier: 'ai' });
    sendLimited(res, result.retryAfterMs);
    return;
  }
  next();
}

export function authRateLimit(req: Request, res: Response, next: NextFunction): void {
  const ip = getClientIp(req);
  const result = check(`auth:${ip}`, TIERS.auth);
  if (result.limited) {
    logRateLimitHit(ip, req.method, req.url);
    logSuspiciousTraffic(ip, 'Auth endpoint rate limit exceeded', { path: req.url, tier: 'auth' });
    sendLimited(res, result.retryAfterMs);
    return;
  }
  next();
}

export function templateRateLimit(req: Request, res: Response, next: NextFunction): void {
  const ip = getClientIp(req);
  const result = check(`template:${ip}`, TIERS.templates);
  if (result.limited) {
    logRateLimitHit(ip, req.method, req.url);
    sendLimited(res, result.retryAfterMs);
    return;
  }
  next();
}

// ── WebSocket connection limiter (non-Express) ──────────────────────────

export function isWsConnectionAllowed(ip: string): { allowed: boolean; retryAfterMs: number } {
  const result = check(`ws:${ip}`, TIERS.wsConnect);
  if (result.limited) {
    logRateLimitHit(ip, 'WS', 'connection');
    logSuspiciousTraffic(ip, 'WebSocket connection flood', { tier: 'wsConnect' });
  }
  return { allowed: !result.limited, retryAfterMs: result.retryAfterMs };
}

// ── Bot / abuse detection middleware ────────────────────────────────────

const BLOCKED_UA_PATTERNS = [
  /^$/,
  /curl\//i,
  /wget\//i,
  /python-requests/i,
  /scrapy/i,
  /httpclient/i,
  /java\//i,
  /go-http-client/i,
  /node-fetch/i,
  /axios\//i,
];

export function botDetection(req: Request, res: Response, next: NextFunction): void {
  // Skip health and root endpoints
  if (req.path === '/health' || req.path === '/') {
    next();
    return;
  }

  const ua = req.headers['user-agent'] || '';
  const ip = getClientIp(req);

  // Block requests with no User-Agent on API routes
  if (!ua && req.path.startsWith('/api/')) {
    logSuspiciousTraffic(ip, 'Missing User-Agent on API request', { path: req.url });
    res.status(403).json({ error: 'Forbidden' });
    return;
  }

  // Block known bot/scraper user agents on API routes
  if (req.path.startsWith('/api/')) {
    for (const pattern of BLOCKED_UA_PATTERNS) {
      if (pattern.test(ua)) {
        logSuspiciousTraffic(ip, 'Blocked bot user-agent', { ua, path: req.url });
        res.status(403).json({ error: 'Forbidden' });
        return;
      }
    }
  }

  next();
}
