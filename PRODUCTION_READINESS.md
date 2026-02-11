# Production Readiness Checklist

**Last review:** February 2026 (Track A – Phase 6)

## Security

### Row Level Security (RLS)
- **profiles, songs, events, event_items:** RLS enabled in `supabase/migrations/001_initial_schema.sql`. Policies: view/insert/update/delete own rows (via `auth.uid()` and `user_id`).
- **avatars storage:** RLS policies in `005_setup_avatar_storage.sql` (upload/update/delete own, public read).
- **Bible tables:** Use service role or ensure RLS policies exist for any direct client access.

### API / Backend
- **CORS:** Configured from `CORS_ORIGIN` env (default `http://localhost:3000`). Production should set origin to frontend domain.
- **HTTP rate limiting:** In-memory rate limit in `backend/src/index.ts` (window and max from `HTTP_RATE_LIMIT_WINDOW_MS`, `HTTP_RATE_LIMIT_MAX`; default 120 req/min per client key).
- **Input validation:** WebSocket messages validated with Zod schemas in `backend/src/types/schemas.ts` and handler.

### Environment / Secrets
- **Frontend:** Only `NEXT_PUBLIC_*` vars used (Supabase URL, anon key, WS URL, STT provider). No server secrets in client bundle.
- **Backend:** Service role key and API keys must stay server-side only; not referenced in frontend.

## Resilience

- **Error boundary:** React error boundary added at app layout level to avoid blank screen on uncaught errors.
- **WebSocket:** Connection retry and RTT monitoring; slide cache for offline resilience (see PROJECT_PLAN.md Latency Attack Summary).

## E2E

- Playwright specs in `e2e/`: `landing.spec.ts` (smoke, no auth), `events.spec.ts`, `live-session.spec.ts`, `projector.spec.ts`, `songs.spec.ts`. Run with `npm run test:e2e`.
- **Smoke (no auth):** `npm run test:e2e -- e2e/landing.spec.ts` – landing and public pages only.
- **Full E2E** (events, songs, live session) require Supabase auth: set `TEST_USER_EMAIL` and `TEST_USER_PASSWORD` for a test user, or tests that use `login()` will fail at redirect to `/dashboard`.
- See `TESTING_QUICK_START.md` and `playwright.config.ts`. WebServer in config starts backend (3001) and frontend (3000).

## Documentation

- WebSocket protocol and types: `backend/src/types/websocket.ts`, `frontend/lib/websocket/types.ts`.
- README links to key docs; ENV_SETUP.md for environment variables.
