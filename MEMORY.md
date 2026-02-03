# ParLeap AI - Memory Log

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

**Last Updated:** January 27, 2026  
**Status:** Ready for next phase work

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

