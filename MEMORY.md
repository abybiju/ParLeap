# ParLeap AI - Memory Log

## Session: February 2026 — Songs UX, community templates, matcher, latency

### What we did
- **Strict metadata + iTunes Auto-Fill**: Format-song prompt now has METADATA RULES — fill artist only from explicit cues (By, Written by, Artist:, ©); do not guess (e.g. no "Hillsong" from style). New `frontend/lib/utils/metadataSearch.ts`: `findSongMetadata(query)` via iTunes Search API (free, no key). Song editor: Wand2 "Auto-Fill" button next to Title; on click fills Artist from title lookup; toast on success / "No match found".
- **CCLI-only template fetch**: When user enters CCLI, we fetch all community templates for that CCLI (no lyrics). "Community formats for this CCLI" block shows line count + upvotes + "Use this format". Selecting one sets `selectedTemplateId`; hint: "Paste lyrics with N lines to apply it." SongPreviewCards receives `templatesFromCcliOnly` and `selectedTemplateId`; no duplicate fetch when lyrics are pasted; applies template when line count matches.
- **Community template after Create Song**: On Create Song (new, with CCLI), dialog asks "Save this format to Template Community?" [No, just create] [Yes, save to community]. Backend enforces max 3 distinct formats per CCLI; when limit reached returns `limitReached`, song still created, toast: "Created. This song already has 3 community formats; your format is saved to your song only."
- **Section labels in slide preview**: SongPreviewCards treats Chorus, Verse, Bridge, etc. as section labels — not counted in "X lines" badge; rendered as small muted headers. `isSectionLabel()` + `contentLineCount()` in preview.
- **Similar-line matcher**: In matcherService, when best match is a *later* line, we compare current vs target line with `compareTwoStrings`. If similarity ≥ SIMILAR_LINE_THRESHOLD (0.65), we block next-line advance and stay on current line; advance only via end-of-line. Prevents jumping to repeated/similar lines (e.g. "To sing the song of ages" / "Will sing the song of ages").
- **Live session fixes (Feb 17)** (already in MEMORY): Matcher crash when jumping songs (clamp currentLineIndex, guard getAdaptiveEndTrigger); Event Not Found + Next Slide copy; RATE_LIMITED exempt START_SESSION + friendlier toast.
- **Latency / STT**: Instrumentation in handler and STT service; docs (STT_LATENCY_MEASUREMENT.md, read logs). Quick wins: remove projector setTimeout, 1024-sample buffer. Decided to stick with ElevenLabs; Google STT comparison optional later.
- **Hum-to-Search**: YouTube-style (768D embedding service) + BasicPitch fallback; ingest retry; templates store structure only so we cannot auto-paste lyrics when user clicks "Use this format" (line count must match pasted lyrics).

### Commits (representative)
- `1e54af3` — feat(songs): strict metadata prompt + iTunes Auto-Fill; CCLI-only template fetch UX

### Key lessons
- Community templates are structure-only (slide ranges); no lyric text stored — so "Use this format" means "paste lyrics with this line count," not "paste lyrics for me."
- Line count match is strict: template applies only when `parseLyricLines(lyrics).length === template.line_count`. Auto-Format helps get structure; does not fetch by CCLI.

---

## Session: February 18, 2026 — Landing: Ready for any song + album art

### What we did
- **Ready for any song (FlowScrollLine)**: Replaced LyricWall with scroll-driven section. 12 song titles (added What A Beautiful Name, King Of Kings; "Firm Foundation (He Won't)" → "Firm Foundation"). Tightened spacing (mb-4, mt-5, py-12/16, no min-height) so no big gap between heading and titles.
- **Album art (WorshipStream)**: Dual source — iTunes worship search + Apple Music top albums RSS; merge worship-first then top charts (max 40). Refresh every 6h and on window focus; if nothing new, keep showing current (repeat). Use `Promise.allSettled` so one failing source (e.g. CORS on RSS) doesn’t hide the other.

### Commits
- `d581deb` — feat(landing): FlowScrollLine + WorshipStream dual source and refresh

### Key lesson
- **Dual external APIs**: When merging two feeds (worship + top charts), fetch with Promise.allSettled and merge fulfilled results only so CORS or one failure doesn’t blank the section.

---

## Session: February 17, 2026 — Live session fixes (matcher crash, Event Not Found, RATE_LIMITED)

### What we did
- **Matcher crash when jumping songs**: Session could have `currentLineIndex` past last line (e.g. 14 for 14-line song). `getAdaptiveEndTrigger(lines[14])` threw. Fixed by: (1) guarding `getAdaptiveEndTrigger` for null/empty; (2) using clamped `effectiveLineIndex` in `findBestMatch`; (3) clamping line index in handler on GO_TO_ITEM and SESSION_STARTED.
- **Event Not Found + Next Slide**: Clearer backend error message (check Supabase URL/service role key). Frontend toast suggests checking backend env on production. NextSlidePreview shows "Start session to see next slide" when no setlist instead of "End of setlist".
- **RATE_LIMITED**: Exempted START_SESSION from WebSocket control rate limit so starting a session never triggers it. Frontend shows friendlier warning toast when RATE_LIMITED occurs (e.g. from rapid slide changes).

### Commits
- `f72b151` — fix: clamp currentLineIndex to prevent matcher crash when jumping songs
- `6448b39` — fix: clearer Event Not Found message and Next Slide copy when no session
- `e258f33` — fix: exempt START_SESSION from rate limit; friendlier RATE_LIMITED toast

### Key lesson
- **Out-of-range indices**: Whenever session or song context stores a line/slide index, clamp it to the current song’s line count at the source (handler) and defensively in the matcher so one bad path can’t crash the match loop.

---

## Session: February 16, 2026 — Hum-to-Search: YouTube-style embedding + live hum + lazy Supabase

### What we did
- **Python embedding microservice** (`hum-embedding-service/`): FastAPI + Wav2Vec2 (`facebook/wav2vec2-base`), POST WAV → 768D vector. Deployed to Railway. Audio trimmed to 30s max to prevent OOM on full-length tracks.
- **Supabase migration 017**: `embedding vector(768)` column on `song_fingerprints`, IVFFlat index, `match_songs_by_embedding()` RPC.
- **Dual-path hum search**: `humSearchService.ts` uses YouTube-style (768D via embedding service + `match_songs_by_embedding`) when `EMBEDDING_SERVICE_URL` is set; falls back to BasicPitch (128D + `match_songs`).
- **Live hum-to-search**: `humSearchLiveService.ts` — stream 2s audio chunks, 5s rolling buffer, embedding service lookup, returns match on the fly. Frontend `ListeningOverlay.tsx` has "Match as you hum" toggle. Endpoints: `live/available`, `live/start`, `live/chunk`, `live/stop`.
- **Ingest script**: Dual-vector (128D + 768D), retry 3x with backoff. Successfully processed Way Maker + Amazing Grace.
- **Lazy Supabase init**: Refactored `supabase.ts` from module-load to first-access init (`getSupabaseClient()`, `isSupabaseConfigured()`). Fixed false "not configured" warning in scripts. Updated all 8 consumer files.
- **EPIPE root cause**: Full-length WAVs (17–36 min) caused Railway OOM. Fixed by trimming to 30s + retry logic.
- **Type-check fixes**: Unused `req` param, `wav.fmt` cast.

### Commits
- `ce41b7c` — feat: YouTube-style hum search
- `2471838` — fix: trim audio to 30s, env at call time, retry
- `f5c421e` — refactor: lazy-init Supabase client
- `f6d7e2c` — fix: type-check errors

### Key technical lessons
- **Module load order**: ES imports execute before any code in the importing file. `dotenv.config()` cannot run before transitive imports. Solution: lazy init (read env on first access, not import time).
- **Railway memory**: Wav2Vec2 + large audio files can exceed Railway container limits. Always trim/limit input size.
- **Retry is cheap insurance**: Transient EPIPE from container restarts is caught by simple retry with backoff.

---

## Session: Event edit workspace + structured announcement text (this session)

### What we did
- **Event edit page – Spotify-style layout**: Replaced cramped two-column (Setlist | Library) with a **left sidebar** (event form compact + nav) and **full-width main** that switches between **Setlist** and **Content Library**. No more small scrollable frames; operators get one view at a time with room to work. New components: `EventEditWorkspace`, `EventEditSidebar`, `EventFormCompact`, `SetlistView`. Page uses `EventEditWorkspace` with full width (`max-w-[1920px]`).
- **View-switch animation**: Framer Motion `AnimatePresence` + `motion.div` when switching Setlist ↔ Content Library (fade + short horizontal slide, 0.2s). Added `overflow-x-hidden` on main to prevent a brief horizontal scrollbar during the animation.
- **Structured announcement text (exact wording)**: Operators can type **exact names, dates, and lines** per slide so AI/image typos don’t show on the projector. Data: optional `structuredText: { title?, subtitle?, date?, lines[] }` per slide. Editor: “Exact wording (recommended for names, dates)” section in Announcement tab (Heading, Subtitle, Date, Line 1–4). Backend: when `structuredText` is present, DISPLAY_UPDATE sends `slideLines` (and optional image as background). Projector: if both image and slideLines → image as dimmed background + text overlay; if only slideLines → text-only layout; if only image/video → full-screen media as before. Backward compatible with image/video-only slides.

### Commits
- `2c38c60` — announcement input options + event edit page layout (overflow, glass-card)
- `ac5209c` — feat: Spotify-style event edit workspace (sidebar + full-width views)
- `b319b82` — view-switch animation (Setlist / Content Library)
- `3692d84` — fix: overflow-x-hidden during view-switch animation
- `cc62e39` — feat: structured announcement text (exact wording, no AI/image typos)

### Docs
- Plan: structured announcement slides (optional structuredText; editor, backend, projector). Revert with `git revert cc62e39` if we remove the feature.

---

## Session: February 15, 2026 - Announcement click shows image on operator and projector

### What we did
- **Operator**: CurrentSlideDisplay now renders slideImageUrl/slideVideoUrl (image-only, video-only, or with text overlay) so when the operator clicks an announcement in the setlist, the picture shows on the operator screen as well as on the projector.
- **Backend**: GO_TO_ITEM supports optional itemId when itemIndex is out of range (e.g. frontend has 6 items, backend only 3). eventService.fetchEventItemById(eventId, itemId) loads one event_item with announcement_slides; handler uses it to build DISPLAY_UPDATE with slideImageUrl and broadcast.
- **Frontend**: SetlistPanel sends item.id with goToItem(index, item.id); WebSocket MANUAL_OVERRIDE payload includes itemId for GO_TO_ITEM.

### Commits
- `522f8a9` — fix: announcement click shows image on operator and projector

---

## Session: February 15, 2026 - Grab Text + device upload + canvas eraser (announcement slides)

### What we did
- **Grab Text**: Tesseract.js client-side OCR in the event editor (Announcement tab). Button on each slide with image (URL or file); pre-fills Exact wording (title, subtitle, date, lines). Best for straight, Latin text. Research: `CANVA_GRAB_TEXT_RESEARCH.md`.
- **Device upload**: Bucket `announcement-assets` (migration 014, RLS). "Add files as slides" turns pending files into slides; on "Add announcement to setlist" we upload, get URLs, then save. Helper: `announcementUpload.ts`.
- **Clean image (eraser)**: react-konva canvas editor — draw white brush over image to cover text; Save exports PNG, uploads, updates slide URL. Frontend-only for now; Fal/Replicate inpainting can be added later.
- **Migration 014**: Fixed `CREATE POLICY IF NOT EXISTS` (invalid in PostgreSQL); use `DROP POLICY IF EXISTS` then `CREATE POLICY`. User confirmed success.

### Commits
- `2196946` — feat: Grab Text + device upload + canvas eraser for announcement slides

### Docs
- `CANVA_GRAB_TEXT_RESEARCH.md` — how Canva Grab Text works (confirmed vs inferred), build-your-own guidance.
- Manual: create bucket `announcement-assets` in Supabase Dashboard if not exists.

---

## Session: February 13, 2026 - Advance/jump todo, homophone fix, docs

### What we did
- **Bible verse advance** and **cross-chapter/cross-book jump** are not working reliably; documented as backlog/todo (fix later).
- **STT homophone fix**: "daniel one" often heard as "daniel won" — added normalization in `bibleService.normalizeReferenceText`: won/one→1, two/too→2, for/four→4, ate/eight→8, plus five/six/seven/nine/ten. "to" is not normalized so "verse 1 to 3" range is preserved.
- **Docs**: BIBLE_SEMANTIC_BACKLOG.md (homophones shipped, advance + jump in backlog), PROJECT_PLAN.md, project-context.mdc updated. Memory (this file + memory/2026-02-13.md) updated.

---

## Session: February 13, 2026 - Bible Semantic Refinements

### What We Shipped
- **Semantic (vector) for Bible only**: OpenAI embeddings for verse-by-content open and Bible Follow; lyrics stay fuzzy.
- **Full-Bible open by content**: Keyword search on `bible_verses.search_text` → up to 80 candidates → semantic rerank; fallback to 15 well-known verses.
- **Jump within same chapter**: When following a passage, saying content of another verse in that chapter jumps display (works well).
- **Reference UX**: Chapter-only ("Luke 1", "Luke chapter 1" → verse 1); book soundalikes ("roman", "romen" → Romans, etc.); fuzzy book match (string-similarity ≥ 0.82) when no alias matches.
- **Cross-chapter jump path**: Handler runs full-Bible content lookup when in Bible Follow; in practice in-chapter jump works, cross-chapter/cross-book not yet reliable (on backlog).

### Backlog (saved for later)
1. **Improve cross-chapter/cross-book jump** — Make saying rephrased content of a verse in another chapter/book reliably jump there.
2. **Reduce Bible verse latency** — Optimize without breaking; consider throttling, caching, or precomputed verse embeddings.
3. **Brainstorm open-source semantic** — Explore Hugging Face–style model runnable in Node.js or Edge Function (cost/latency/on-prem).

### Docs
- `BIBLE_SEMANTIC_BACKLOG.md` — Shipped behavior + backlog.
- `PROJECT_PLAN.md` — Recent updates + pointer to backlog.

### Commits
- `7557b45` — feat(bible): chapter-only refs, book soundalikes, fuzzy book, cross-chapter jump
- Earlier: `9efa18a` (full-Bible + in-passage jump), `5fc135e` (verse-by-content open), `d964934` (semantic Bible Follow), `ebd98f2` (lint)

---

## Session: February 13, 2026 - Community Template Stability and Remaining Apply Gap

### Shipped Today
- Frontend template safety hardening:
  - Guard template payloads before apply/render (`id`, `slides`, `line_count`, range checks).
  - Prevented `slice` runtime errors from malformed templates.
- Backend template normalization:
  - `template_stats.template_id` now mapped to `id`.
  - Added legacy `slides` normalization to indexed ranges.
- Form warning cleanup:
  - Added explicit file input `name`.
  - Removed duplicate `name` collision on lyrics textarea.

### Commits
- `e2aaf79` — fix: harden template rendering against malformed ids
- `1de8451` — fix: normalize template_stats rows and legacy slide payloads
- `d40520e` — chore: add name to file input, drop duplicate name on lyrics

### Current Reality
- Crash is fixed.
- Auto-apply still inconsistent in production for some CCLI+lyrics combinations; UI may show `None applied` and keep raw pasted formatting.
- Next resume point: validate runtime line-count parity and API response shape for `GET /api/templates`.

## Session: February 12, 2026 - Community Templates & File Import

### What We Shipped
- Structure-only **community templates** in Supabase (`community_templates`, `template_votes`, `template_stats` view) with unique `(ccli_number, structure_hash)` and `usage_count` increments on upsert.
- **Auto-apply** templates when `ccli_number` + `line_count` match; prefer `score >= 0` (fallback to `>= -5` if nothing better). Low-score templates effectively suppressed.
- **Swap Template dialog** in Song Editor listing templates (score/usage/slide count) with apply + warning for low scores.
- **Silent auto-submit on save**: when a song with CCLI is saved, current slides/sections are hashed and upserted in the background; matching hashes only bump usage.
- **File import** for SongSelect `.usr` / `.txt`: client-side parser fills title/artist/CCLI/lyrics and immediately auto-applies templates. PDF intentionally unsupported.

### Docs Updated
- New `COMMUNITY_TEMPLATES.md` (current behavior, APIs, testing, limits).
- `CCLI_SONGSELECT_INTEGRATION.md` now notes SongSelect API program is closed; active path is file import + community templates (scraper/API only if CCLI reopens).

### Risks / Follow-ups
- Verify Next.js build stability for `slideServiceProxy` importing backend service directly.
- Need E2E pass: auto-apply, swap dialog, auto-submit upsert, `.usr` parse, usage increment in Supabase.

## Session: Password Reset / Forgot Password Flow

### What We Shipped
- **Forgot password page** (`/auth/forgot-password`): Email form → `resetPasswordForEmail(email, { redirectTo: origin + '/auth/reset-password' })`; success message and link back to login.
- **Reset password page** (`/auth/reset-password`): User lands from email link; Supabase establishes session from URL hash; form for new password + confirm; `updateUser({ password })` then redirect to dashboard with toast.
- **Login page**: "Forgot your password?" link (below password label) → `/auth/forgot-password`.
- **Profile Security section**: "Reset Password" button opens dialog; new password + confirm → `updateUser({ password })`; toast and close.

### Supabase URL Configuration (Manual)
- **Site URL** must be production base (e.g. `https://www.parleap.com`) so recovery emails point there, not localhost.
- **Redirect URLs** must include `https://www.parleap.com/auth/callback` and `https://www.parleap.com/auth/reset-password` (and optionally `parleap.com` without www, `par-leap.vercel.app`, or `https://par-leap-*.vercel.app/auth/callback` and `.../auth/reset-password` for previews).

### Commit
- `8c00cf3` — feat: forgot password flow and reset from profile

### Files
- `frontend/app/auth/forgot-password/page.tsx`, `frontend/app/auth/reset-password/page.tsx`
- `frontend/app/auth/login/page.tsx` (forgot link)
- `frontend/components/profile/sections/SecuritySection.tsx` (reset modal)

---

## Session: February 11, 2026 - Bible in Live Setlist + Smart Listen Gate Fixes

### Problem: Bible Items Not Showing in Live Setlist
**Status: ⚠️ Fix deployed but not yet verified working**

**Root Cause Identified**: PostgREST INNER JOIN on `songs()` embed excludes Bible items (song_id IS NULL).
- Original schema: `song_id NOT NULL`
- Migration 011 drops NOT NULL, but PostgREST schema cache may still use INNER JOIN

**Fixes Applied**:
1. **Backend**: Split eventService query — fetch `event_items` and `songs` separately (no embed)
2. **Backend**: Smart Listen gate no longer requires `BIBLE_SMART_LISTEN_ENABLED` env var; honors client toggle
3. **Frontend**: SetlistPanel merges missing Bible/Media items from initialSetlist
4. **Frontend**: OperatorHUD tracks `currentItemIsBible` from local clicks + initialSetlist fallback
5. **Diagnostic**: Added `/api/debug/event-items/:eventId` endpoint

**Commits**: `3097cd0`, `b435214` (both pushed, CI passed)

**NOT YET VERIFIED** — user reports still not working after deploy. Need to:
1. Test debug endpoint with actual event ID
2. Check browser console logs
3. Possibly run `NOTIFY pgrst, 'reload schema'` in Supabase SQL editor

### Key Technical Lesson
- PostgREST uses INNER JOIN for `songs()` embed when `song_id` has cached NOT NULL constraint
- Splitting queries into separate calls avoids this entirely
- Always add diagnostic endpoints early when debugging production issues

---

## Session: February 11, 2026 - Bible Follow + STT Stability Improvements

### What We Shipped
- **Bible passage auto-follow** after an explicit reference, with a **Following badge + Stop** control in Operator HUD.
- **Matcher recovery** when transcripts stall: temporary backward window to re-lock the song.
- **GhostText confidence guard** to avoid 0% stickiness on partial transcripts.
- **Expanded Bible reference parsing** for natural phrasing (e.g., “Luke chapter 2 verse 1”, “Romans chapter 4 verse 5 to 15”).

### Commits
- `a60e359` — matcher recovery + STT 0% guard
- `ce79927` — bible passage auto-follow
- `47e25c8` — parsing variants
- `d7be9f5` — eslint regex escape fix

---

## Session: February 11, 2026 - Smart Listen gating, mic fallbacks (reverted), Psalms alias

### Notes
- Smart Listen: songs stay continuous when Bible mode is off; gate applies only to non-song items when Bible mode is on (`bf08290`).
- Mic getUserMedia fallbacks (deviceId/default/explicit) were tried and then reverted after “Requested device not found” errors (`a0986ae`, `a66f615`, `8621795`); reverted to prior mic logic.
- Added Psalms mis-hear aliases (`sams`, `salms`) so STT/wake maps “sams/salms” to Psalms (`b650ba7`).

---

## Session: February 10, 2026 - Smart Audio Decision and Checkpoint Plan

### Decision: Implement Smart Audio Without Stack Change
**Date/Time recorded:** 2026-02-10 (documented for rollback reference)

**What we decided:**
- **Keep:** `ws` (native WebSocket) and Supabase client. **Do not** introduce Socket.io or Prisma.
- **Implement:** Smart Audio behavior (state machine + Gatekeeper + ring buffer) on top of existing stack per [SMART_BIBLE_LISTEN.md](SMART_BIBLE_LISTEN.md).
- **Tuning choices:** Optional naming (e.g. SERMON for cost-optimized mode); buffer size 3s vs 10s as configurable.

**Rollback safety (if something goes wrong):**
- Before any Smart Audio implementation: create **CURRENT_STATE_CHECKPOINT.md** and commit it. It must record:
  - **Git:** Commit hash and branch (e.g. `fdb81de`, `main`). Restore with `git checkout <commit>` or revert.
  - **Current behavior:** SONG = always stream to ElevenLabs; BIBLE = current Bible follow (no gatekeeper); real-time = ws only.
  - **Key files:** `backend/src/websocket/handler.ts`, `backend/src/services/sttService.ts`, `frontend/lib/hooks/useAudioCapture.ts`, WebSocket types, operator components.
  - **Revert:** (1) Code: checkout/revert to checkpoint commit. (2) If Smart Listen is behind a flag: turn it off so "Always Listen" restores current behavior.
- Implementation must be **additive only**; default = current behavior; one **kill switch** (env or UI) to disable Smart Listen everywhere.

**Plan reference:** `.cursor/plans/smart_audio_architecture_feasibility_456139d2.plan.md` (Sections 6–7: Checkpoint and Implementation outline).

**Next step when implementing:** Create CURRENT_STATE_CHECKPOINT.md first, commit, then implement Smart Audio steps in order.

---

## Session: February 6, 2026 (Afternoon) - Event Management UI Bug Fixes 🐛

### Critical Bug Fixes for Polymorphic Setlist Feature
**Fixed TypeScript errors, database constraint violations, and partial fix for setlist items in live session.**

### What We Accomplished
1. **TypeScript Type-Check Fixes** ✅
   - Fixed unused variables and imports across 5 files
   - Fixed duplicate import in WebSocket handler
   - Fixed type casting issues in eventService (needed `as unknown as` pattern)
   - Commit: `7688fd6` - "fix: resolve TypeScript type-check errors"

2. **Duplicate Key Constraint Violation (Drag-and-Drop)** ✅
   - Problem: Error when reordering items via drag-and-drop
   - Solution: Two-phase sequential update (temp values → final values)
   - Added PostgreSQL function `reorder_event_items()` for atomic updates
   - Commits: `09c3b8f`, `69250ba`

3. **Null song_id Constraint Violation** ✅
   - Problem: Error when adding Bible/Media items (song_id was NOT NULL)
   - Solution: Made `song_id` nullable in migration
   - Commit: `09c3b8f`

4. **Setlist Items Not Loading in Live Session** ⚠️ (Partial)
   - Problem: Setlist items not appearing in live session
   - Solution Applied: Added `setlistItems` to SESSION_STARTED message, updated caching
   - Status: Fix applied but user reports still not working - needs investigation
   - Commit: `8d91e41`

### Key Technical Decisions
- **Sequential Updates**: Use two-phase approach (temp values → final) to avoid constraint violations
- **PostgreSQL Functions**: Prefer atomic database functions for complex operations
- **Type Casting**: Use `as unknown as` pattern for Supabase query results when TypeScript can't infer structure
- **Data Flow**: Ensure new fields flow through entire pipeline: DB → Backend → WebSocket → Frontend → Display

### Files Modified
- Backend: `eventService.ts`, `handler.ts`, `websocket.ts` (types)
- Frontend: `SetlistBuilder.tsx`, `SetlistItemCard.tsx`, `SetlistLibrary.tsx`, `actions.ts`, `slideCache.ts`, `useWebSocket.ts`, `live/[id]/page.tsx`, `websocket/types.ts`
- Database: `011_add_polymorphic_setlist_items.sql` (migration)

### Outstanding Issues
- Setlist items not showing in live session (needs debug tomorrow)

---

## Session: February 6, 2026 (Morning) - Smart Bible Listen Feature Documentation 📋

### Feature Design Discussion & Documentation
**Documented Smart Bible Listen feature for future implementation - cost optimization for Bible mode.**

### What We Accomplished
1. **Smart Bible Listen Feature Specification** ✅
   - Complete technical specification documented in `SMART_BIBLE_LISTEN.md`
   - Two-stage hybrid system: Local wake-word detection + selective STT activation
   - Estimated cost savings: 87-93% for 40-minute sermons
   - Architecture: Browser wake-word detection → Backend selective STT (30s windows)
   - Quote-only matching: Opt-in only (disabled by default)

2. **Bible Service Enhancement** ✅
   - Added bidirectional book lookup cache (`byId` map)
   - Enables O(1) reverse lookups by book ID
   - Committed: `ae0d81a` - "feat: add bidirectional book lookup cache in bible service"
   - Pushed to production

3. **Documentation Updates** ✅
   - Updated `PROJECT_PLAN.md` with Smart Bible Listen reference
   - Updated `NEXT_PHASE_PLAN.md` with Phase 8: Smart Bible Listen
   - Created comprehensive feature specification document

### Key Decisions & Preferences
- **Default Behavior**: Smart Listen ON by default when Bible mode is on
- **STT Window**: 30 seconds after wake word detected
- **Quote Matching**: Opt-in only (disabled by default)
- **Ring Buffer**: 10 seconds of audio context
- **Cost Indicator**: Show savings in UI

### Technical Opinion Shared
**The Core Challenge**: Can't detect Bible content without STT running (chicken-and-egg problem)

**Recommended Solution**: Hybrid two-stage system
- Stage 1: Local wake-word detection (zero API cost) - runs in browser
- Stage 2: Selective STT window (controlled cost) - only when wake word detected
- Audio ring buffer ensures full reference captured even if wake word mid-sentence

**Quote-Only Detection**: Expensive (requires full-text matching against all ~31,000 verses)
- Recommendation: Opt-in only, with warning about cost impact
- Only search after Bible reference detected (provides context)

### Feature Status
- **Status**: 📋 Documented (not yet implemented)
- **Priority**: Medium (cost optimization, not critical path)
- **Complexity**: Medium-High (requires frontend + backend coordination)
- **Risk**: Low (can fallback to always-on STT if issues occur)

### Files Created/Modified
- `SMART_BIBLE_LISTEN.md` - Complete feature specification (new)
- `PROJECT_PLAN.md` - Added Future Features section (updated)
- `NEXT_PHASE_PLAN.md` - Added Phase 8: Smart Bible Listen (updated)
- `MEMORY.md` - Added February 6, 2026 entry (updated)
- `memory/2026-02-06.md` - Daily log entry (new)
- `backend/src/services/bibleService.ts` - Bidirectional cache (committed)

### Next Steps
- Feature is documented and ready for future implementation
- Implementation can begin when prioritized
- See `SMART_BIBLE_LISTEN.md` for complete technical specification

---

## Session: February 3, 2026 (Evening) - Live Session UX Fixes ✅

### Critical Fixes Completed
**All operator HUD display and layout issues resolved.**

### What We Accomplished
1. **Fixed RATE_LIMITED Audio Error** ✅
   - Buffer size: 256 samples (16ms, 62 chunks/sec) → 2048 samples (128ms, 8 chunks/sec)
   - Prevents "Too many messages in a short period" error
   - Still maintains low latency (128ms vs original 256ms)

2. **Lowered Auto-Switch Threshold** ✅
   - Changed from 85% → 50% confidence for auto-switching
   - User feedback: "84% match shouldn't require manual click"
   - Now auto-switches immediately at 50%+ confidence (after 2 sustained matches)
   - Applies universally to all songs in setlist

3. **Fixed Multi-Line Display on Auto-Switch** ✅
   - Problem: Main slide showing only 1 line when AI auto-switched songs
   - Root cause: Auto-switch DISPLAY_UPDATE missing `slideLines` and `slideText` arrays
   - Fix: Backend now fetches full slide data during song switches
   - Result: All 4 lines now display correctly in all scenarios

4. **Optimized Layout for Screen Fit** ✅
   - Problem: 4-line display with large fonts pushed next slide preview off screen
   - Fixes applied:
     - CurrentSlideDisplay: `text-5xl` → `text-3xl`, reduced padding/spacing
     - NextSlidePreview: `text-lg` → `text-sm`, compact spacing
     - OperatorHUD: Reduced container padding
   - Space saved: ~200px vertical space
   - Result: Both current slide (4 lines) + next slide preview now visible

5. **Fixed Stop Button Hidden by Header** ✅
   - Problem: Fixed navigation header (64px) overlapping Stop Session button
   - Fix: Added `pt-16` (64px) top padding to OperatorHUD container
   - Additional improvements: Compact header, event name truncation, proper z-index
   - Result: All header controls (Auto-Follow, Status, Stop) fully visible

### Current Production Configuration

**Audio System (ElevenLabs STT)**:
- Format: PCM 16-bit (pcm_s16le), 16kHz, mono
- Buffer: 2048 samples (128ms latency)
- Message rate: ~8 chunks/sec (safe, no rate limiting)
- Session-aware: Only sends when `sessionActive=true`
- Ref handling: Uses `sessionActiveRef` to prevent stale closures

**Matching Algorithm**:
- Auto-switch threshold: **50% confidence** (lowered from 85%)
- Debouncing: 2 sustained matches required
- Cooldown: 3 seconds between song switches
- Current song checked first (optimization)
- **End-of-line detection**: Last 40% of words trigger advance (65% confidence)
- **Forward-only constraint**: Never allows backward progression (prevents repeated lyrics backtracking)

**Display Layout**:
- Main slide: `text-3xl` font, `space-y-1.5` line spacing, 4 lines
- Next slide: `text-sm` font, compact spacing, fully visible
- Container: `pt-16` to account for fixed header
- Header: Compact with truncating event names

### Files Modified This Session
**Backend**:
- `backend/src/websocket/handler.ts` - Auto-switch full slide data

**Frontend**:
- `frontend/components/operator/CurrentSlideDisplay.tsx` - Font/spacing optimization
- `frontend/components/operator/NextSlidePreview.tsx` - Font/spacing optimization  
- `frontend/components/operator/OperatorHUD.tsx` - Layout fixes (padding, header)
- `frontend/lib/hooks/useAudioCapture.ts` - Buffer size (256 → 2048)

### Commits Created (9 Total)
1. `9648ef8` - Fix RATE_LIMITED error
2. `ca8029e` - Lower auto-switch threshold (85% → 50%)
3. `11cc8a7` - Document display bug (safe point)
4. `32b443c` - Fix auto-switch multi-line display
5. `6683919` - Update memory (display fix)
6. `05240c1` - Optimize layout spacing
7. `6510991` - Document layout optimizations
8. `78f96b9` - Fix Stop button overlap
9. `45f7b03` - Document header fix

### Git Status
- ✅ All changes committed locally
- ⏳ Push pending: Network/credential issues
- Ready for Railway deployment

### Safety & Rollback
**Revert points if issues occur**:
- Before layout changes: `git reset --hard 6683919`
- Before header fix: `git reset --hard 05240c1`
- Before any changes: `git reset --hard ca8029e`

### Lessons Learned
1. **Buffer size matters**: Too small = rate limiting, too large = latency
2. **Layout math**: Always account for fixed headers (64px = `pt-16`)
3. **Confidence thresholds**: UX feedback > arbitrary thresholds
4. **Multi-line data**: All DISPLAY_UPDATE messages must include full slide arrays
5. **Ref closures**: Use `useRef` for callbacks that need current state

### Latest Session: End-of-Line Detection & Forward-Only Constraint

**End-of-Line Detection** (Commits `501a554`, `1e9d504`, `a392b8b`):
- Detects last 40% of words in current line
- Advances immediately when 65%+ confidence match found
- Adapts to line length (short lines trigger faster)
- Reduces perceived latency by ~500-1000ms

**Forward-Only Constraint** (Commit `5603869`):
- Prevents backward jumps when lyrics repeat across stanzas
- Example: "He will make a way for me" appears at end of multiple stanzas
- System now stays forward or advances, never jumps back
- Manual PREV button still works (bypasses constraint)

**Testing**: Verified with "God will make a way" song (repeated stanza endings)

### Next Session TODO
- Monitor ElevenLabs connection stability in production
- Test with songs of varying lengths (17+ slides)
- Verify end-to-end latency <300ms
- Consider AudioWorklet migration (ScriptProcessor deprecated)
- Consider making end-of-line percentage configurable per-song

---

## Session: February 2, 2026 - Landing Page Gradient Restoration & Reference State ⚠️

### Critical Lesson: Landing Page Protection
**This is the day we messed up our landing page and we don't do it again.**

**Established Reference State:**
- Landing page style from February 2, 2026 is the **DEFINITIVE REFERENCE**
- **Rule:** Landing page should NOT change without explicit user approval and verification
- Created `LANDING_PAGE_REFERENCE_FEB_2_2026.md` as permanent reference document

### What We Accomplished
1. **Restored Landing Page Gradient** ✅
   - Brown-to-blue fade gradient: `linear-gradient(to bottom, #1a0f0a 0%, #1a0f0a 30%, #0f0a1a 60%, #0a0f1a 80%, #000a1a 100%)`
   - Extended brown/orange mix further down (to 30%)
   - Made bottom blue darker (`#000a1a`)
   - Smooth transitions with intermediate color stops

2. **Restored Mouse Follow Spline** ✅
   - Using `kzdIEyudaZu1oiNQ` (mouse follow effect, NOT robot)
   - Only visible in hero section

3. **LyricsWall Restoration** ✅
   - Removed orange effect overlay
   - Restored to original state (inherits body gradient)

### Key Configuration (DO NOT CHANGE)
- **Gradient:** Brown (`#1a0f0a`) at top → Dark blue (`#000a1a`) at bottom
- **Spline:** Mouse follow effect (`kzdIEyudaZu1oiNQ`)
- **LyricsWall:** No separate background, inherits body gradient
- **Main container:** Simple `min-h-screen` class

### Important Rules Established
- ❌ **NEVER** change landing page without asking user first
- ❌ **NEVER** modify gradients, Spline, or backgrounds without approval
- ✅ **ALWAYS** reference `LANDING_PAGE_REFERENCE_FEB_2_2026.md` when restoring
- ✅ **ALWAYS** verify with user before committing landing page changes

### Git Status
- ✅ Committed: Enhanced gradient with extended brown mix
- ⏳ Push pending: Network issues

### Documentation Created
- `LANDING_PAGE_REFERENCE_FEB_2_2026.md` - Permanent reference document with exact configuration

---

## Session: January 29, 2026 - Premium UI Components & Custom Date Picker ✅

### What We Accomplished
1. **Custom Holographic Timestamp Date-Time Picker** ✅
   - Completely rebuilt `GlassDatePicker` component without Calendar dependency
   - Custom date grid with full day names (Monday-Sunday)
   - Split view layout: 320px date picker + 200px time picker
   - Month/year navigation views (click headers to switch)
   - Auto-time feature with Target icon (⌖) in top-right corner
   - Orange brand colors throughout (gradients, borders, focus states)
   - Removed 📍 icon from timezone footer
   - Mission Control aesthetic with deep black glass background

2. **Premium Notification Hover Effects** ✅
   - Added "Luminous Hover" effect to notification items in DashboardHeader
   - Background lights up subtly (`bg-white/5`) with inner glow shadow on hover
   - Sliding orange bar marker on left edge (slides in from left on hover)
   - Text brightening effect (`group-hover:text-gray-300`) for message text
   - Smooth transitions (200-300ms) for all hover states
   - Premium micro-interaction feedback matching Linear/Raycast aesthetic

### Git Status
- ✅ Committed: `442dad9` - Custom Holographic Timestamp picker
- ✅ Committed: `48c48e6` - Remove 📍 icon from calendar
- ✅ Committed: `840d9b2` - Premium notification hover effects
- ⏳ Push pending: Network issues (3 commits ready to push)

### Technical Details
- **Date Picker**: Custom implementation with helper functions (getDaysInMonth, isToday, etc.)
- **Notification Hover**: Uses Tailwind `group` class for coordinated hover states
- **Orange Brand Theme**: Consistent use of orange-to-red gradients throughout
- **Design Philosophy**: Premium micro-interactions that "wake up" under mouse cursor

### Next Steps
- Push commits when network available
- Test date picker in production
- Verify notification hover effects work smoothly

---

## Session: January 30, 2026 - TypeScript Fixes & Watermark Discussion ✅

### What We Accomplished
1. **TypeScript Declarations Fixed**
   - Created `frontend/types/spline-viewer.d.ts`
   - Updated `tsconfig.json` to include types directory
   - Fixed CI/CD type-check errors for custom web components

2. **Tested Local Changes (Reverted)**
   - Tried black gradient instead of brown - darkened robot's face
   - Confirmed current design is optimal
   - Kept published version intact

3. **Spline Watermark Research**
   - Free tier includes "Built with Spline" watermark
   - Options: Spline Pro ($12/month), keep free with watermark, or migrate to Three.js
   - **Decision**: Keep current setup (watermark is subtle and professional)

### Git Status
- ✅ Committed: TypeScript declarations fix
- ⏳ Push pending: Network issues
- ⏳ Previous commit ready: `dd1c52a` - Landing page redesign

### Next Steps
- Push commits when network available
- Final decision on Spline watermark approach
- Continue with feature development

---

## Session: January 29, 2026 - Landing Page Redesign Complete ✅

### Landing Page Updates
- **Spline 3D Integration**: Cursor-follow effect background in hero section
- **Glass Header**: Seamless merge with hero, larger logo (56px), increased height (h-24)
- **New Logo**: Transparent gradient design, matches Superlist style
- **Footer**: Logo only (no text), consistent with header
- **UI Placeholder**: Archived to `frontend/public/assets/archive/ui-mockup-placeholder.png` for future use
- **Smooth Transitions**: Gradient overlays between sections for unified design

### Git Status
- ✅ Committed: `dd1c52a` - Landing page redesign with Spline 3D background

---

## Session: January 29, 2026 - Hum-to-Search Implementation & Debugging

### Current Status: ⚠️ IN PROGRESS - Async Processing Implemented

**What's Working:**
- ✅ Ingestion pipeline (2 songs processed successfully)
- ✅ Database migration applied (song_fingerprints table + match_songs function)
- ✅ Backend API endpoint created
- ✅ Frontend UI with real audio recording
- ✅ Async job queue implemented (prevents timeouts)

**Current Issues:**
- ⚠️ BasicPitch inference is very slow (30-60 seconds) causing timeouts
- ⚠️ Async processing implemented but needs testing
- ⚠️ TypeScript errors fixed but not yet pushed

---

## Session: January 29, 2026 - Hum-to-Search COMPLETE! 🎉

### What We Accomplished Today

#### 1. Ingestion Pipeline WORKING ✅
- **Folder renamed**: "ParLeap AI" → "ParLeap-AI" (fixed path issues)
- **Successfully processed 2 songs**:
  - Way Maker (92MB WAV) → 128D vector stored
  - Amazing Grace (43MB WAV) → 128D vector stored
- **Technical fixes**:
  - Monorepo model path (packages hoisted to root node_modules)
  - Node.js 24 + tfjs-node incompatibility → removed tfjs-node
  - file:// protocol unsupported → monkey-patched global fetch()

#### 2. Backend Search API ✅ NEW!
- **Endpoint**: `POST /api/hum-search`
  - Accepts base64-encoded WAV audio
  - Extracts 128D melody vector
  - Searches via pgvector cosine similarity
  - Returns matching songs with similarity scores

- **Service**: `backend/src/services/humSearchService.ts`
  - `searchByHum(audioBuffer, limit, threshold)`
  - Calls Supabase `match_songs()` RPC function

#### 3. Enhanced UI Components ✅ UPGRADED!
- **HumButton** (two variants):
  - `icon`: Compact mic button with hover glow
  - `full`: Larger button with "Hum to Search" text
  - Gradient styling, animations

- **ListeningOverlay** (complete rewrite):
  - **Real audio recording** via MediaRecorder API
  - **Live waveform visualization** (AudioContext + AnalyserNode)
  - **Recording timer** (auto-stops at 10 seconds)
  - **Processing spinner** with animated sparkles
  - **Results display** with similarity badges (green/orange/gray)
  - **Error handling** with retry option
  - **Beautiful animations**: pulse rings, fade-in-up, scale-in

- **New Tailwind Animations**:
  - `waveform-fast`, `pulse-ring`, `pulse-ring-slow`
  - `bounce-subtle`, `shimmer`, `fade-in-up`, `scale-in`

### Files Modified/Created
```
backend/src/services/humSearchService.ts  (NEW)
backend/src/services/melodyService.ts     (fixed fetch)
backend/src/index.ts                      (added endpoint)
frontend/components/search/HumButton.tsx  (enhanced)
frontend/components/search/ListeningOverlay.tsx (rewritten)
frontend/tailwind.config.ts               (new animations)
```

### Technical Details
- **Vector Dimensions**: 128D (64 pitch intervals + 64 rhythm ratios)
- **Key-Invariant**: Uses semitone differences, not absolute pitches
- **Tempo-Invariant**: Normalizes rhythm ratios by total duration
- **Search Threshold**: 0.4 (40% similarity minimum)
- **Recording Duration**: 5 seconds max (reduced from 10s to prevent payload issues)

---

## Session: January 29, 2026 - Production Debugging & Async Processing

### Issues Fixed Today

1. **Audio Format Mismatch** ✅ FIXED
   - Problem: Frontend recorded WebM, backend expected WAV
   - Solution: Created `audioUtils.ts` with WAV encoder, switched to AudioContext

2. **Payload Too Large (413 Error)** ✅ FIXED
   - Problem: 10 seconds = 578KB base64, exceeded Express default
   - Solution: Reduced to 5 seconds, increased Express limit to 10MB

3. **Request Timeouts** ✅ FIXED (Async Solution)
   - Problem: BasicPitch takes 30-60s, frontend timeout = 30s
   - Solution: Async job queue - return jobId immediately, poll for results

4. **Timer Bug** ✅ FIXED
   - Problem: Timer went negative, auto-stop didn't work
   - Solution: Used refs instead of state closures, proper cleanup

5. **TypeScript Errors** ✅ FIXED (Not Yet Pushed)
   - Problem: `any` types in jobQueue, missing type assertions
   - Solution: Generics `Job<T>`, added type assertions for `job.result`

### Async Job Queue Implementation

**Backend:**
- `POST /api/hum-search` - Creates job, returns jobId immediately
- `GET /api/hum-search/:jobId` - Poll for status/results
- In-memory job storage (Map<string, Job>)
- Auto-cleanup after 1 hour

**Frontend:**
- Creates job → gets jobId
- Polls every 1 second (max 60 attempts)
- Shows "Analyzing melody..." while polling
- No timeout errors

### Files Created/Modified

**New:**
- `frontend/lib/audioUtils.ts` - WAV encoder
- `backend/src/services/jobQueue.ts` - Async queue
- `HUM_SEARCH_STATUS.md` - Status documentation

**Modified:**
- `frontend/components/search/ListeningOverlay.tsx` - Complete rewrite (WAV + async)
- `backend/src/index.ts` - Async endpoints, payload limit
- `backend/src/services/melodyService.ts` - Enhanced logging

### Current Status

**Ready:**
- ✅ All code written
- ✅ TypeScript passes locally
- ✅ Lint passes locally
- ✅ Async processing implemented

**Pending:**
- ⏳ Push latest TypeScript fixes
- ⏳ Test end-to-end in production
- ⏳ Verify BasicPitch works on Railway
- ⏳ Check processing times in logs

### Tomorrow's Priorities

1. Push latest commits (TypeScript fixes for job.result)
2. Test async processing end-to-end
3. Monitor Railway logs for performance
4. Consider optimizations if BasicPitch is too slow
5. Add user feedback for long processing times

### Backup Plan: Fastify Server Approach

**If async processing doesn't work, user has researched an alternative:**

- Use Fastify instead of Express
- Handle file uploads with `@fastify/multipart`
- Simpler request/response (no async queue needed)
- Might handle large payloads better

**See `TODO_TOMORROW.md` for full implementation details.**

**Note:** This doesn't solve BasicPitch slowness but might simplify architecture and handle uploads better.

### Status
- ✅ Ingestion pipeline working
- ✅ Backend search API complete
- ✅ Frontend UI with real audio recording
- ✅ Beautiful animations and UX
- ⏳ End-to-end testing on production

---

## Session: January 28, 2026 - Header Navigation Improvements

### What We Accomplished Today

#### Header Navigation Layout Enhancements ✅
- Increased header height from `h-16` to `h-20` (64px → 80px) for better visual hierarchy
- Added top padding `pt-6` (24px) to push header down from viewport top
- Repositioned navigation links (Features, Pricing, Download) to sit between logo and buttons using flex layout instead of centered positioning
- Updated HeroSection padding from `pt-40` to `pt-48` to account for taller header
- Maintained responsive behavior (nav links hidden on mobile)

#### Documentation Updates ✅
- Updated `README.md` with header improvements in Recent Updates
- Updated `PROJECT_STATUS_COMPLETE.md` with detailed header specifications
- Updated `LANDING_PAGE_DESIGN.md` with header layout details

### Git Commits
- **Commit 1:** `4775d12` - "Improve header navigation layout: increase height, add top spacing, reposition nav links"
- **Commit 2:** `b3bef02` - "Update documentation: Header navigation layout improvements"
- **Status:** Committed locally, push pending (network connectivity issues)

### Technical Notes
- Layout uses three-section flex: Logo (left) → Nav Links (flex-1 justify-end) → Buttons (right)
- Creates natural spacing without forcing center alignment
- Total header space: 24px padding + 80px height = 104px

### User Feedback
- User requested header height increase and navigation repositioning
- User wanted nav links positioned between logo and buttons (not centered)
- User approved final implementation and requested documentation updates

---

## Session: January 27, 2026 - Phase 4 Complete

### What We Accomplished Today

#### Sprint 1: State Management ✅
- Created `frontend/lib/stores/songsStore.ts` — Full CRUD for songs with search
- Created `frontend/lib/stores/eventsStore.ts` — Event management with setlist support
- Created `frontend/lib/stores/liveSessionStore.ts` — Live session state management
- All stores use Zustand + Supabase integration

#### Sprint 2: E2E Tests ✅
- Created `e2e/utils/test-helpers.ts` — Reusable test utilities (login, create song/event, wait for WebSocket, etc.)
- Created `e2e/songs.spec.ts` — CRUD + search tests
- Created `e2e/events.spec.ts` — Event creation, setlist management, live session tests
- Created `e2e/live-session.spec.ts` — WebSocket connection, transcription, manual navigation tests
- Created `e2e/projector.spec.ts` — Projector view sync, keyboard shortcuts, fullscreen tests
- All tests use Playwright with proper selectors and error handling

#### Sprint 3: Projector View Enhancement ✅
- Enhanced `frontend/components/projector/ProjectorDisplay.tsx`:
  - Smooth fade transitions (300ms+)
  - Keyboard shortcuts: Space/→ (next), Backspace/← (prev), F11 (fullscreen)
  - Fullscreen API support with mode tracking
  - Better typography and text shadow for readability
  - Hidden UI elements in fullscreen mode
  - Connection status display

#### Sprint 4: Auth Polish ✅
- Enhanced login page with animated loading spinner
- Enhanced signup page with animated loading spinner
- Created `frontend/app/profile/page.tsx`:
  - User email display (read-only)
  - Username editing with update button
  - Subscription tier display with upgrade button
  - Account stats (member since, user ID)
  - Sign out functionality
  - Full Zustand integration with authStore
- Updated `frontend/middleware.ts` to protect `/profile` route

### Git Commit
- **Commit:** `4922d8d` pushed to `origin/main`
- **Message:** "feat: Complete Phase 4 implementation - Zustand stores, E2E tests, projector enhancements, auth polish"
- **Files Changed:** 15, Insertions: 1,898

### Current Project Status

**Phase Status:**
- ✅ Phase 1: Foundation & Infrastructure
- ✅ Phase 2: Real-Time Engine (WebSocket, Audio, STT)
- ✅ Phase 3: Predictive Matching
- ✅ Phase 4: Frontend Features (COMPLETE TODAY)
  - ✅ 4.1: Authentication (with profile)
  - ✅ 4.2: Songs Library
  - ✅ 4.3: Event Management
  - ✅ 4.4: Operator Dashboard + Projector View
  - ✅ 4.5: State Management
- ✅ Phase 5: Testing Infrastructure (147 tests + E2E suite)

### Key Integrations
- All stores use Supabase client
- E2E tests use Playwright with test environment
- ProjectorDisplay uses WebSocket hooks
- Profile page uses authStore for state
- Middleware protects all authenticated routes

### Deployment Status
- **Frontend:** https://www.parleap.com (Vercel)
- **Backend:** https://parleapbackend-production.up.railway.app (Railway)
- **Database:** Supabase (PostgreSQL)

### Next Steps
1. Performance Optimization (Phase 5.2)
2. Production Readiness Review (Phase 6)
3. CCLI SongSelect Integration (Post-Launch)
4. Monitor CI/CD pipeline for any regressions

### Technical Notes
- No `any` types used - full TypeScript strict mode
- All components follow functional component + hooks pattern
- Glassmorphism styling maintained throughout
- <500ms latency target for projector transitions
- E2E tests can run in CI/CD with proper mocking

### ClawdBot Governor System
- `CLAWDBOT_INSTRUCTIONS.md` created (in previous session)
- Safety protocols established for autonomous work
- Ready for ClawdBot to work during off-hours

---

## Architecture Decisions

1. **Zustand over Redux:** Simpler, less boilerplate, better for small-to-medium teams
2. **Playwright for E2E:** Better WebSocket support, full-page tests possible
3. **Profile Page:** Essential for user management, subscription tracking
4. **Projector Keyboard Shortcuts:** Operator-friendly, no modal confusion

## Lessons Learned

1. **E2E Test Selectors:** Need to be flexible (aria-labels, text content, data-testid)
2. **WebSocket Testing:** Use custom events for mocking in tests
3. **Animation Timing:** 300ms+ transitions feel smoother for slide changes
4. **Auth Flow:** Profile management centralizes user experience

---

**Last Updated:** February 18, 2026  
**Status:** Songs UX: strict metadata + iTunes Auto-Fill, CCLI-only template fetch, community save dialog (max 3/CCLI), section labels in preview. Matcher: similar-line block (no premature advance). Live fixes: matcher crash on jump, Event Not Found, RATE_LIMITED. Latency instrumentation and docs. Hum-to-Search dual-path (YouTube-style + BasicPitch); templates structure-only.

---

## Session: February 3, 2026 - Profile Settings + Avatar Upload (Presets + Device) ✅

### What We Accomplished
1. **Profile Settings page (Sidebar layout)** ✅
   - Route: `/dashboard/profile`
   - Tabs: General / Account / Security / Billing
   - Added “Back to Dashboard” navigation link

2. **Avatar system (saved to `profiles.avatar`)** ✅
   - Presets:
     - Emoji presets (e.g. `rocket`, `planet`)
     - Image presets saved as `preset:*` IDs (assets in `frontend/public/avatars/presets/`)
   - Device upload:
     - Upload to Supabase Storage bucket `avatars`
     - Store resulting public URL in `profiles.avatar`

3. **Dashboard header reflects latest avatar** ✅
   - `DashboardHeader` now renders preset image / emoji / uploaded URL instead of always initials.

4. **Mission Control UI polish** ✅
   - Fixed invisible outline-button text (“Cancel”, “Reset Password”)
   - Added subtle orange hover glow on Profile cards

### Operational Notes (Supabase)
- If you see: `Could not find the 'avatar' column of 'profiles' in the schema cache`:
  - Ensure `public.profiles.avatar` column exists (migration 004)
  - Reload PostgREST schema cache (SQL fallback: `select pg_notify('pgrst', 'reload schema');`)
- Device uploads require Storage bucket `avatars` + policies (migration 005).

### Lessons Learned
- Vercel/CI TypeScript checks fail on unused vars/params—avoid placeholder params without `_` prefix.
- `next/image` is not ideal for `blob:` previews and external avatar URLs without remotePatterns—use `<img>` for those.


## February 4, 2026 - Operator HUD + STT Reliability
- Operator HUD redesigned into a broadcast control room layout with a unified signal stack, hero display surface, and docked command controls.
- Controls modernized (glass gradients, chevrons, pulsing Start Session) for premium operator feel.
- End-of-line auto-advance improved: adaptive end-words, hybrid next-line support, and debounce for stability.
- Added ElevenLabs STT watchdog to auto-restart the stream if transcripts go stale while audio continues.
- STT UI now distinguishes "Audio streaming (No transcripts)" from true idle state.
- Type-check run clean after ElevenLabs stream guard fix.

## February 5, 2026 - Projector Font Selection
- Operator HUD now offers a projector font selector (curated Google Fonts).
- Selection persists on events (`projector_font`) and broadcasts live to projector + operator slide view.
- Added migration 007 and updated Supabase types, WS messages, and UI wiring.

## February 5, 2026 - Bible Mode MVP
- Added Bible mode toggle + version selector in Operator HUD with persisted event settings (`bible_mode`, `bible_version_id`).
- Ingests KJV JSON into `bible_versions`, `bible_books`, `bible_verses` with BOM-safe parser.
- Added RLS select policy for `bible_versions` and default-version fallback if none is selected.
- Reference parsing MVP displays verses (e.g., “Luke 2:13”) on Operator + Projector.
- Fixed session stability during silence and resume flow after Bible mode off.
- Added ESV API support (on-demand fetch, no local storage) with voice-command version switching.
- Railway env configured with `ESV_API_KEY` + `ESV_API_URL` for live ESV fetches.
- Voice-command version changes now persist to `events` so refreshes keep the selected version.
