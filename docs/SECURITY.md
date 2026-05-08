# ParLeap Security Architecture

## Authentication

- **Frontend**: Supabase SSR client with cookie-based sessions. Protected routes enforced in `frontend/middleware.ts`.
- **Backend**: Bearer token validation via `requireAuth` middleware. Calls `supabase.auth.getUser(token)` (server-verified, not cookie-only).
- **WebSocket**: Token passed as `?token=` query param. Validated before accepting connection.
- **Password policy**: 8+ chars, uppercase, lowercase, number.

## HTTPS & Security Headers

### Backend (`backend/src/index.ts`)
- **helmet.js** — sets X-Content-Type-Options, X-Download-Options, X-XSS-Protection, etc.
- **HTTPS enforcement** — 301 redirect from HTTP to HTTPS in production
- **HSTS** — `Strict-Transport-Security: max-age=31536000; includeSubDomains`
- **trust proxy** — enabled for Railway/Vercel reverse proxy

### Frontend (`frontend/next.config.js`)
- `X-Frame-Options: DENY` — clickjacking prevention
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(self), geolocation=()`
- `Strict-Transport-Security: max-age=31536000; includeSubDomains`

## Rate Limiting

Tiered rate limiting in `backend/src/services/rateLimiter.ts`:

| Tier | Limit | Endpoints |
|------|-------|-----------|
| Global | 120 req/min per IP | All endpoints |
| AI | 10 req/min per IP | `/api/format-song`, `/api/hum-search/*`, `/api/fingerprint` |
| Templates | 30 req/min per IP | `POST /api/templates` |
| WebSocket | 10 connections/min per IP | WS handshake |

All 429 responses include `Retry-After` header. Env vars `HTTP_RATE_LIMIT_WINDOW_MS` and `HTTP_RATE_LIMIT_MAX` override global tier defaults.

### Frontend Auth Throttling (`frontend/lib/utils/authRateLimit.ts`)
- Progressive lockout after 5 failed login/signup attempts: 30s → 1min → 5min
- Uses `sessionStorage` (resets on tab close, auto-resets after 15min idle)
- Clears on successful authentication

## Bot Detection

Middleware in `backend/src/services/rateLimiter.ts`:
- Blocks requests with no `User-Agent` on `/api/*` routes
- Blocks known scraper/bot user agents: curl, wget, python-requests, scrapy, httpclient, go-http-client, node-fetch, axios
- Skips `/health` and `/` (monitoring tools)

## Security Logging

Structured JSON logging in `backend/src/services/securityLogger.ts`:

| Event Type | Trigger |
|------------|---------|
| `AUTH_SUCCESS` | Successful Bearer token validation |
| `AUTH_FAILURE` | Missing/invalid/expired token |
| `WS_AUTH_SUCCESS` | Successful WebSocket authentication |
| `WS_AUTH_FAILURE` | Missing/invalid WebSocket token |
| `RATE_LIMIT_HIT` | Any rate limit exceeded |
| `API_ERROR` | Unhandled server error (500) |
| `SUSPICIOUS_TRAFFIC` | Auth failure bursts, bot UA, WS flood |

### Suspicious Traffic Detection
- Tracks auth failures per IP over a 5-minute sliding window
- Alerts when an IP hits 10+ failures in the window
- Logs AI rate limit violations and WebSocket connection floods

## Secrets Management

- Backend secrets stored in `backend/.env` (gitignored)
- Production secrets set in Railway dashboard → Service Variables
- GitHub Actions secrets for CI workflows (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`)
- Startup validation: server exits immediately if required env vars are missing
- No hardcoded secrets in source code (verified)

## IDOR Prevention

- All backend DB queries on user data include `user_id` filter
- Service role key bypasses RLS — ownership checks are in application code
- `verifyEventOwnership()` helper in `eventService.ts`
- WebSocket sessions store userId; all event access is ownership-verified

## CORS

- Configurable via `CORS_ORIGIN` env var (comma-separated)
- Auto-expands to include www/non-www variants of parleap.com
- Credentials enabled for cookie-based auth
