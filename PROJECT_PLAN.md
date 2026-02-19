# ParLeap - Comprehensive Project Plan

## 🎯 Project Overview

ParLeap is a real-time, AI-powered presentation orchestration platform that automates content display (lyrics, captions, sermon notes) at live events by listening to speakers/singers and synchronizing visual output instantly.

**Core Value Proposition:** Eliminate manual slide switching with a predictive AI layer that matches live audio to pre-loaded content.

---

## 📅 Recent Updates

### Landing album art: proxy API, Christian/worship only (February 2026) ✅
- **WorshipStream** ("Every song, One flow"): Album art from iTunes **"modern worship" only** (no secular top charts). Fetched via **GET /api/landing/album-art** (Next.js route) — server proxies iTunes to avoid CORS/blockers in the browser. When empty: section shows message + Retry; images `unoptimized`. Files: `frontend/app/api/landing/album-art/route.ts`, `frontend/components/landing/WorshipStream.tsx`. Commits: `dea85e7`, `b480322`, `844cf9f`.

### Songs UX: strict metadata, iTunes Auto-Fill, CCLI templates, community save (February 2026) ✅
- **Strict metadata + iTunes Auto-Fill**: formatSongService METADATA RULES — fill artist only from explicit cues (By, Written by, Artist:, ©); no guessing. `frontend/lib/utils/metadataSearch.ts`: `findSongMetadata(query)` via iTunes Search API (no key). Song editor: Wand2 "Auto-Fill" next to Title; fills Artist from title lookup; toast on success / no match / error.
- **CCLI-only template fetch**: When CCLI is entered (debounced), fetch templates by CCLI only (no line count). "Community formats for this CCLI" block: line count, upvotes, "Use this format". SongPreviewCards: `templatesFromCcliOnly`, `selectedTemplateId`; no duplicate fetch when lyrics pasted; section labels (Verse, Chorus, Bridge, etc.) not counted in content line count / slide preview.
- **Community template after Create Song**: On Create Song (new, with CCLI), dialog "Save this format to Template Community?" [No, just create] [Yes, save to community]. Backend: max 3 distinct formats per CCLI; when limit reached returns `limitReached`, song still created. Toasts: saved / "already 3 community formats" / just created.
- **Similar-line matcher**: matcherService: when best match is a later line, compare current vs target with `compareTwoStrings`; if ≥ SIMILAR_LINE_THRESHOLD (0.65), block next-line advance (stay on current); advance only via end-of-line. Prevents skipping on repeated/similar lines.
- **Commit**: `1e54af3` (strict metadata + iTunes Auto-Fill; CCLI-only template fetch UX).

### Auto-Format (Smart Paste) – Song lyrics formatting ✅
- **Feature**: In the song editor (New Song / Edit), user pastes raw lyrics and clicks "Auto-Format". Backend calls OpenAI gpt-4o-mini with structured JSON output; frontend fills Title, Artist, and Lyrics.
- **Backend**: `POST /api/format-song` (body: `{ rawText }`). Service: [backend/src/services/formatSongService.ts](backend/src/services/formatSongService.ts). Uses `OPENAI_API_KEY` (same as Bible Follow).
- **Prompt rules**:
  - **Title & artist**: Fill the title field and the artist field whenever the song title or artist name appears in the text; return null only when not explicitly present.
  - **Sections**: Structure into Verse 1, Verse 2, Chorus, Bridge, etc.; infer labels if missing.
  - **Pagination (critical)**: Target 4 lines per slide, max 6. If a section exceeds 6 lines, split into balanced slides (e.g. 8→4+4, 7→4+3, 6→3+3). Orphan rule: never a slide with only 1 line (unless the whole section is 1 line). Split at end of sentence or phrase; keep rhyming couplets together when possible. When splitting, use the same label for each part (e.g. "Bridge" for both).
- **Schema**: `{ title, artist, sections: [{ label, lines }] }`. Multiple sections may share the same label when a long section is split. No schema change required for pagination.
- **Commit**: `0d0cb54` (initial); prompt updated for musician-grade pagination (balanced splits, orphan rule) without separate commit ref.

### Event edit workspace + structured announcement text ✅
- **Event edit page**: Spotify-style layout — left sidebar (event form + Setlist / Content Library nav) and full-width main that switches between Setlist view and Content Library view. No cramped scroll frames. Components: EventEditWorkspace, EventEditSidebar, EventFormCompact, SetlistView. View-switch animation (Framer Motion, 0.2s) with overflow-x-hidden to avoid horizontal scrollbar.
- **Structured announcement text**: Optional exact wording per slide (`structuredText`: title, subtitle, date, lines). Editor has "Exact wording (recommended for names, dates)" in Announcement tab. Projector shows operator-typed text in a fixed layout (with optional image as dimmed background). Avoids AI/image typos for names and dates. Backward compatible. Commits: `2c38c60`, `ac5209c`, `b319b82`, `3692d84`, `cc62e39`.

### Announcement click → image on operator and projector (February 15, 2026) ✅
- **Operator view**: `CurrentSlideDisplay` now renders `slideImageUrl` / `slideVideoUrl` (image-only, video-only, or image/video + text overlay) so announcement pictures show when the operator clicks the announcement in the setlist.
- **Backend**: `GO_TO_ITEM` supports optional `itemId` when `itemIndex` is out of range (e.g. frontend setlist longer due to merge from initialSetlist). `fetchEventItemById` in eventService loads a single event_item with `announcement_slides` from DB; handler resolves by id and broadcasts `DISPLAY_UPDATE` with `slideImageUrl`.
- **Frontend**: SetlistPanel sends `item.id` with `goToItem(index, item.id)`; WebSocket `MANUAL_OVERRIDE` payload includes optional `itemId` for `GO_TO_ITEM`.
- **Commit**: `522f8a9`

### Grab Text + device upload + canvas eraser (February 15, 2026) ✅
- **Grab Text**: Tesseract.js client-side OCR in Announcement tab; button pre-fills Exact wording (title, subtitle, date, lines) from image (URL or file). Best for straight, Latin text.
- **Device upload**: "Add files as slides" from device/drop; upload to `announcement-assets` on Add to setlist. Migration 014 (RLS); create bucket in Dashboard if needed.
- **Clean image**: react-konva canvas editor with frontend-only eraser brush; Save exports PNG and updates slide URL. API inpainting (Fal/Replicate) can be added later.
- **Research**: `CANVA_GRAB_TEXT_RESEARCH.md` — how Canva does it, build-your-own guidance.
- **Commit**: `2196946`

### Bible Semantic Refinements (February 13, 2026) ✅
- **Vector/semantic for Bible only**: OpenAI embeddings for verse-by-content open and Bible Follow (paraphrased advance). Lyrics remain fuzzy match.
- **Full-Bible + in-chapter jump**: Keyword search on `bible_verses` then semantic rerank; jump within same chapter by content works.
- **Reference UX**: Chapter-only ("Luke 1" → 1:1), book soundalikes (e.g. "roman" → Romans), fuzzy book match (string-similarity ≥ 0.82).
- **STT homophones**: "daniel won" → Daniel 1 via `normalizeReferenceText` (won/one→1, two/too→2, for/four→4, ate/eight→8, etc.; "to" left as-is for "verse 1 to 3").
- **Backlog / known issues**: Bible verse **advance** not working reliably (fix later); **cross-chapter/cross-book jump** not reliable. See `BIBLE_SEMANTIC_BACKLOG.md` for full backlog (advance, jump, latency, open-source semantic).

---

## 📌 To-Do List

### Fix later (deferred)
- **Avatar storage (migration 005)** — Review/fix `supabase/migrations/005_setup_avatar_storage.sql` when circling back; documented here so we can focus on other work now.

- **Brainstorm semantic AI / Hugging Face** — Explore open-source embedding/semantic models (e.g. Hugging Face) runnable in Node.js or Edge for cost/latency/on-prem. See `BIBLE_SEMANTIC_BACKLOG.md` §4.
- **Work on humming search feature** — Hum-to-Search (find songs by humming) is implemented but testing/performance pending. See `HUM_SEARCH_STATUS.md` for status, next steps, and BasicPitch/queue notes.
- **Background visuals for projector view** — Optional image/video/motion layer behind lyrics; operator-selectable per event or per slide; possible integration with media library or stock. See `BACKGROUND_AND_ANNOUNCEMENTS_ROADMAP.md`.
- **Announcement slides + Ideogram AI** — New announcement slide type (images, graphics, video); optional flow: operator enters prompt → Ideogram API → image stored and added as slide. See Ideogram API docs (https://developer.ideogram.ai/) and `BACKGROUND_AND_ANNOUNCEMENTS_ROADMAP.md`.
- **Expand projector font options** — More font choices e.g. via Google Fonts API or other font APIs; font picker in operator/event settings.

### Password Reset / Forgot Password ✅
- **Forgot password**: `/auth/forgot-password` — email form, `resetPasswordForEmail` with `redirectTo` to `/auth/reset-password`
- **Reset password**: `/auth/reset-password` — handles recovery link (hash-based session), new password + confirm, `updateUser({ password })`, redirect to dashboard
- **Login**: "Forgot your password?" link to `/auth/forgot-password`
- **Profile**: Security section "Reset Password" opens dialog; `updateUser({ password })` when authenticated
- **Supabase**: Site URL and Redirect URLs must be set to production (e.g. `https://www.parleap.com`) so recovery emails do not point to localhost
- **Commit**: `8c00cf3`

### February 11, 2026 - Bible in Live Setlist + Smart Listen Gate ⚠️
- ⚠️ **PostgREST INNER JOIN Fix**: Backend eventService split into separate queries (event_items + songs) to avoid INNER JOIN filtering out Bible items when `song_id IS NULL`
- ✅ **Smart Listen Gate**: No longer requires `BIBLE_SMART_LISTEN_ENABLED` env var; honors client toggle directly
- ✅ **Frontend Resilience**: SetlistPanel merges missing Bible/Media from initialSetlist; OperatorHUD tracks currentItemIsBible locally
- 🔍 **Debug Endpoint**: `/api/debug/event-items/:eventId` for production diagnosis
- **Status**: Fix deployed but needs verification — Bible still not showing in live setlist per user report
- **Commits**: `3097cd0`, `b435214`
- **See**: `.cursor/SESSION_SUMMARY_FEB_11_2026.md` for details

### Landing Page – Scripture & Live Console Showcase ✅
- ✅ **Scripture section**: New "And scripture too." section between LyricWall and TestimonialWall
  - Three cards (verse display, reference follow, one flow) with glass-card-hover, purple accents, BookOpen/Mic/LayoutList icons
  - "Bible Verses" added to FeatureMarquee strip
- ✅ **Live Console showcase**: New section between AIMoment and FeatureMarquee
  - Real operator-console screenshot in a 3D tilt card (mouse-follow rotateX/rotateY via framer-motion)
  - Hover scale + orange glow; click opens lightbox modal (Radix Dialog) for larger view
  - Asset: `frontend/public/landing/operator-console.png`
- **Files**: `ScriptureSection.tsx`, `LiveConsoleShowcase.tsx`, `page.tsx`, `FeatureMarquee.tsx`, `public/landing/operator-console.png`

### February 6, 2026 (Afternoon) - Event Management UI Bug Fixes 🐛
- ✅ **TypeScript Type-Check Fixes**: Resolved all type-check errors (unused imports, duplicate imports, type casting)
- ✅ **Duplicate Key Constraint Violation**: Fixed drag-and-drop reordering with two-phase sequential updates + PostgreSQL function
- ✅ **Null song_id Constraint**: Made `song_id` nullable in migration for polymorphic items
- ✅ **Setlist Items in Live Session**: Fixed - setlist items (songs, Bible, media) now show correctly in live operator view
- **Commits**: `7688fd6`, `09c3b8f`, `69250ba`, `8d91e41`
- **See**: `.cursor/SESSION_SUMMARY_FEB_06_2026.md` for details

### February 6, 2026 (Morning) - Smart Bible Listen Feature Documented 📋
- 📋 **Smart Bible Listen Feature Specification**: Complete technical specification documented for future implementation
  - Cost optimization feature for Bible mode (87-93% STT cost reduction)
  - Two-stage hybrid system: Local wake-word detection + selective STT activation
  - Audio ring buffer (10s) for context capture
  - Quote-only matching (opt-in) for phrase detection
  - See `SMART_BIBLE_LISTEN.md` for complete specification
- ✅ **Bible Service Enhancement**: Added bidirectional book lookup cache (`byId` map)
  - Enables O(1) reverse lookups by book ID
  - Committed: `ae0d81a` - "feat: add bidirectional book lookup cache in bible service"

### February 3, 2026 - Profile Settings + Avatar System ✅
- ✅ **Profile Settings Page**: Created `/dashboard/profile` with sidebar tabs (General / Account / Security / Billing)
  - Added “Back to Dashboard” navigation
  - Consistent Mission Control card layout
- ✅ **Avatar System**:
  - Preset emoji avatars + preset image avatars (`frontend/public/avatars/presets/*`)
  - Device upload to Supabase Storage bucket `avatars`
  - Saved to `profiles.avatar` (preset ID or public URL)
  - Dashboard header avatar reflects latest saved profile state
- ✅ **Operational Docs**:
  - Added `AVATAR_MIGRATION_SETUP.md` with Supabase migration + schema cache reload steps

### January 25, 2026 - Testing & QA Infrastructure Complete ✅
- ✅ **Testing Framework Setup**: Complete testing infrastructure implemented
  - ✅ Jest configured for backend (unit & integration tests)
  - ✅ Vitest configured for frontend (component & hook tests)
  - ✅ Playwright configured for E2E tests (user journey tests)
  - ✅ Test scripts added to all package.json files
  - ✅ Coverage reporting configured (70% target)
  - ✅ Test setup files created (mocks, environment config)
  
- ✅ **Unit Tests Implemented** (131 passing tests)
  - ✅ **Backend** (67 tests): Matcher Service (14), Event Service (15), STT Service (19), WebSocket Handler (19)
  - ✅ **Frontend** (48 tests): Song Editor Modal (21), Setlist Builder (27)
  - ✅ **Coverage**: Backend 85%+, Frontend 70%+
  
- ✅ **Integration Tests Implemented** (16 passing tests)
  - ✅ WebSocket Protocol Flow (16 tests): Connection management, PING/PONG, session lifecycle, message sequencing
  - ✅ Complete client-server communication testing
  
- 📚 **Documentation Created**:
  - `TESTING_QA_PLAN.md` - Comprehensive testing strategy
  - `TESTING_QUICK_START.md` - Quick reference for running tests
  - `TESTING_INFRASTRUCTURE_COMPLETE.md` - Achievement summary and next steps
  
- **Total Tests**: 147 passing tests (131 unit + 16 integration)
- **Status**: ✅ Testing infrastructure production-ready

### January 25, 2026 - Songs Library Implementation Complete
- ✅ **Songs Library - Notion-Style Implementation**: Complete CRUD interface for song management
  - ✅ Song Library page (`/songs`) with DataTable (sortable, searchable)
  - ✅ Song Editor Modal with split-view (raw input | live preview)
  - ✅ Stanza-aware parsing and glassmorphism preview cards
  - ✅ localStorage draft auto-save with recovery prompts
  - ✅ Server Actions for CRUD operations (createSong, updateSong, deleteSong)
  - ✅ CCLI number field added to songs table (migration 002)
  - ✅ Zod validation schema for songs
  - ✅ useSongDraft hook for draft management
  - ✅ Sonner toast notifications integrated
  - ✅ Shadcn components installed (dialog, input, textarea, button, table, badge)
  - ✅ react-hook-form + @hookform/resolvers for form management
  - ✅ @tanstack/react-table for advanced table features
  - **Features**: Fuzzy search, sortable columns, line count badges, real-time stanza preview, auto-save drafts
- 🔧 **Songs Library UX Fixes**:
  - ✅ **Stanza Parser Enhanced**: Handles Windows (\r\n), Mac (\n), and multi-blank line separators
  - ✅ **CCLI Optional Confirmed**: Empty field saves without validation errors
  - ✅ **Visual Improvements**: Better glassmorphism, helper text for stanza separation
  - **Result**: Paste any lyrics and save immediately without issues
- ✅ **Home Page Updated**: Added navigation buttons (Song Library, Dashboard, Test WebSocket)
- **Status**: Code committed locally, pending push to GitHub and deployment

### January 21, 2026 - Operator Console Sprint Complete
- ✅ **Operator Console Implementation**: Complete production-ready interface
  - Event Selector Dashboard (`/dashboard`) - Lists user events with card grid
  - Operator HUD (`/live/[eventId]`) - Three-panel professional layout
  - Projector View (`/projector/[eventId]`) - Full-screen audience display
- 🔧 **WebSocket Connection Stability**: Fixed intermittent connection issues
  - Changed from autoConnect=true to manual connect pattern
  - Added connection stabilization delay (1s) before starting session
  - Applied same pattern to both OperatorHUD and ProjectorDisplay
  - Result: Stable connections, no more "CONNECTING" loops
- 🔧 **Broadcast Synchronization**: Fixed projector view not updating
  - Added broadcastToEvent() helper function in backend
  - Manual overrides (NEXT/PREV) now broadcast to all clients
  - AI auto-advances now broadcast to all clients
  - Result: Perfect real-time synchronization between operator and projector
- ✅ **Supabase Migration**: Migrated from mock data to real database
  - Created new Supabase project
  - Ran migrations successfully
  - Seeded test data for user account
  - Events and songs loading from real database

### January 20, 2026 - MatchStatus Confidence Bug Fixes
- 🔧 **Critical Bug Fix**: MatchStatus not showing confidence percentage
  - **Root Cause**: ElevenLabs sends cumulative transcripts (each includes all previous words), but handler was appending to buffer, causing massive duplication
  - **Fix**: For ElevenLabs, REPLACE rolling buffer instead of appending
  - **Fix**: Changed threshold comparison from `>` to `>=` for consistency with matcher logic
  - **Fix**: `createSongContext` now uses provided `lines` from Supabase setlist instead of parsing empty `lyrics` field
  - **Enhancement**: Added always-on logging for matcher attempts (shows in Railway logs without DEBUG_MATCHER)
  - **Enhancement**: Increased buffer preprocessing window from 12 to 15 words
  - **Commits**: `bc83e03` (buffer handling), `ea79be2` (song context)
  - **Status**: Code pushed to GitHub, pending Railway manual deployment
  - **Note**: Railway auto-deploy not working, requires manual trigger

### January 19, 2026 - ElevenLabs STT Integration & Matching Engine Production-Ready
- ✅ **ElevenLabs Realtime STT**: Fully integrated and working end-to-end
- ✅ **PCM Audio Capture**: Implemented for ElevenLabs streaming
- ✅ **Matching Engine Improvements**: Production-ready with buffer preprocessing
  - Buffer preprocessing (filler words, de-duplication, slicing)
  - Enhanced line transition detection (end-window lookahead)
  - Weighted similarity boost for next-line matches (capped at 1.0)
  - Always sends DISPLAY_UPDATE with confidence when match found
  - Buffer trimming after strong matches
- ✅ **Custom Domain**: www.parleap.com configured and live
- ✅ **Node.js Upgrade**: Upgraded to version 20 (Railway)
- ✅ **Debug Logging**: Enhanced with DEBUG_MATCHER conditional logging
- ✅ **Confidence Display**: Capped at 100% in MatchStatus component
- ✅ **Verified Tests**: MatchStatus shows confidence, auto-advance working

### December 20, 2025 - System Reactivation & Mock Data Mode
- ✅ **System Restarted Successfully**: Backend and Frontend both operational with graceful mock data fallback
- ✅ **Supabase Optional**: Backend now handles missing Supabase credentials elegantly, using mock data by default
- ✅ **WebSocket Test Page**: Fully functional at `/test-websocket` with <5ms latency (1-3ms average)
- ✅ **File Permission Issues Fixed**: Resolved macOS EMFILE errors with increased file limits and node_modules reinstall
- ✅ **Environment Configuration**: Created `backend/.env` template for easy Supabase credential setup
- ✅ **All Builds Passing**: TypeScript compilation successful, no linter errors

### Security & Infrastructure Updates
- ✅ **Security Patches Applied**: Updated Next.js to 14.2.35 and React to 18.3.1 to patch CVE-2025-55184 (DoS) and CVE-2025-55183 (Source Code Exposure)
- ✅ **Backend CORS Configuration**: Added CORS middleware to backend for Vercel frontend integration
- ✅ **Railway Backend Deployment**: Successfully deployed to Railway (parleapbackend-production.up.railway.app)
  - Connected to GitHub with auto-deploy
  - Environment variables configured
  - Health check and root endpoints verified
- ✅ **Version Alignment**: Fixed eslint-config-next version mismatch (now aligned with Next.js 14.2.34+)
- ✅ **WebSocket Connection Setup**: Frontend WebSocket client, React hook, and test component implemented
  - Vercel environment variable `NEXT_PUBLIC_WS_URL` configured
  - Frontend redeployed and ready for Phase 2 implementation
- ✅ **WebSocket Protocol Implementation**: Complete typed message protocol implemented
  - TypeScript interfaces for all message types
  - Zod validation schemas
  - Backend message handlers (START_SESSION, MANUAL_OVERRIDE, STOP_SESSION, PING)
  - Session state management with change detection
  - Frontend typed client with helper methods
  - Message history tracking in test component
  - Protocol tested and verified
- ✅ **Latency Attack Features**: Comprehensive latency monitoring and resilience features implemented
  - **Latenc-o-meter**: Dev tool for measuring pipeline latency at every stage
  - **Ghost Text**: Real-time transcription display for operator trust building
  - **RTT Monitoring**: Continuous connection quality monitoring with degraded mode detection
  - **Slide Caching**: Local browser caching and preloading of next 3 slides
  - **Timing Metadata**: All server responses include timing data for latency measurement
  - **Weak Signal Badge**: Visual indicator when network RTT exceeds 500ms threshold
- ✅ **Production Deployment & Testing**: All features deployed and tested successfully (Dec 2025)
  - ✅ TypeScript errors fixed (unused variables)
  - ✅ Vercel frontend deployment successful
  - ✅ Railway backend deployment successful
  - ✅ WebSocket connection verified in production
  - ✅ All latency features tested and working
- ✅ **Phase 1.2: Supabase Integration** (Dec 14, 2025)
  - ✅ Event service for Supabase queries
  - ✅ Real data fetching in WebSocket handler
  - ✅ Database seed script for test data
  - ✅ Comprehensive documentation (7 guides)
- ✅ **Phase 2.3: Audio Capture** (Dec 14, 2025)
  - ✅ useAudioCapture hook with MediaRecorder API
  - ✅ Audio streaming to WebSocket (AUDIO_DATA messages)
  - ✅ AudioLevelMeter and MicrophoneStatus components
  - ✅ Auto-start/stop with session lifecycle
  - ✅ Permission handling and error recovery
  - ✅ Real-time audio level visualization

---

## 📋 Implementation Phases

### **Phase 1: Foundation & Infrastructure** ✅ (Current)

#### 1.1 Monorepo Setup ✅
- [x] Root workspace configuration
- [x] Frontend (Next.js 14) structure
- [x] Backend (Express/TypeScript) structure
- [x] TypeScript strict mode configuration
- [x] ESLint setup

#### 1.2 Supabase Integration (Next)
- [ ] Create Supabase project
- [ ] Initialize Supabase client in frontend
- [ ] Initialize Supabase client in backend
- [ ] Database schema migration:
  - [ ] `profiles` table
  - [ ] `songs` table
  - [ ] `events` table
  - [ ] `event_items` table
- [ ] Row Level Security (RLS) policies
- [ ] Authentication setup (Supabase Auth)

#### 1.3 Frontend Foundation
- [ ] Install Shadcn/UI components
- [ ] Create base layout with dark mode
- [ ] Set up Zustand stores structure
- [ ] Create routing structure:
  - [ ] `/` - Landing/Dashboard
  - [ ] `/auth` - Authentication pages
  - [ ] `/songs` - Content library
  - [ ] `/events` - Event management
  - [ ] `/live/[eventId]` - Live presentation view
  - [ ] `/operator/[eventId]` - Operator dashboard

#### 1.4 Backend Foundation
- [x] Express server setup with TypeScript
- [x] WebSocket server initialization (`ws` library)
- [x] Environment variable configuration
- [x] CORS middleware configuration
- [ ] Error handling middleware
- [ ] Logging setup
- [x] Health check endpoints

---

### **Phase 2: Real-Time Engine**

#### 2.1 WebSocket Protocol Implementation ✅
- [x] Define TypeScript interfaces for WebSocket messages
- [x] Client-to-Server message handlers:
  - [x] `START_SESSION` - Initialize event session
  - [x] `AUDIO_DATA` - Stream audio chunks (handler ready, needs STT integration)
  - [x] `MANUAL_OVERRIDE` - Manual slide control
  - [x] `STOP_SESSION` - End session
  - [x] `PING` - Keep-alive
- [x] Server-to-Client message handlers:
  - [x] `SESSION_STARTED` - Session confirmation
  - [x] `TRANSCRIPT_UPDATE` - Real-time transcription (handler ready, needs STT integration)
  - [x] `DISPLAY_UPDATE` - Slide change notifications
  - [x] `SONG_CHANGED` - Song change notification
  - [x] `SESSION_ENDED` - Session ended
  - [x] `ERROR` - Error notification
  - [x] `PONG` - Keep-alive response
- [x] Connection management (handle disconnects, reconnects)
- [x] Message validation with Zod schemas
- [x] Session state management
- [x] Frontend WebSocket client with typed messages
- [x] React hook for WebSocket integration
- [x] Test component for protocol verification

#### 2.3 Audio Capture (Frontend) ✅
- [x] Browser microphone access (`MediaRecorder` API) ✅
- [x] Audio chunk streaming to WebSocket ✅
- [x] Audio format configuration (16kHz, mono, WebM Opus) ✅
- [x] Error handling for microphone permissions ✅
- [x] Visual feedback for audio capture status ✅
- [x] Audio level visualization ✅

#### 2.4 AI Transcription Integration ✅
- [x] Choose STT provider (ElevenLabs Scribe selected) ✅
- [x] Set up API credentials and configuration ✅
- [x] Streaming transcription implementation ✅
- [x] Audio format conversion for STT provider (PCM) ✅
- [x] Error handling and retry logic ✅
- [x] Transcription buffer management ✅

#### 2.5 Backend Audio Processing Pipeline ✅
- [x] WebSocket audio chunk receiver ✅
- [x] Audio buffer management ✅
- [x] Forward audio to STT provider ✅
- [x] Receive and parse transcription results ✅
- [x] Maintain rolling buffer (last 100 words) ✅
- [x] Logging and monitoring ✅

---

### **Phase 3: Predictive Matching Algorithm**

#### 3.1 Content Loading & Caching ✅
- [x] On `START_SESSION`, fetch event items from Supabase (or mock) ✅
- [x] Load song lyrics and parse into lines ✅
- [x] Cache setlist in memory (Node.js SessionState) ✅
- [x] Handle setlist updates during live session ✅
- [x] Error handling for missing content (mock fallback) ✅

#### 3.2 Fuzzy Matching Engine ✅
- [x] Implement string similarity algorithm (`string-similarity`) ✅
- [x] Compare rolling buffer against current song lines ✅
- [x] Similarity threshold: 0.7 (configurable) ✅
- [x] Handle partial matches and edge cases ✅
- [x] Performance optimization (<20ms overhead) ✅
- [x] Match confidence scoring ✅
- [x] Enhanced line transition detection (end-window lookahead) ✅
- [x] Weighted similarity boost for next-line matches ✅

#### 3.3 Slide Management Logic ✅
- [x] Track current slide index ✅
- [x] Detect when last line of song is matched ✅
- [x] Auto-advance to next slide on match ✅
- [x] Handle manual overrides ✅
- [x] Buffer trimming after strong matches ✅
- [x] State persistence across reconnects ✅

#### 3.4 Dual Screen Logic
- [ ] Operator Dashboard (control view)
- [ ] Audience/Projector View (display view)
- [ ] Separate WebSocket channels or message routing
- [ ] Synchronization between views
- [ ] Preview mode for operator

---

### **Phase 4: Frontend Features**

#### 4.1 Authentication & User Management
- [ ] Supabase Auth integration
- [ ] Login/Signup pages
- [ ] Protected routes
- [ ] User profile management
- [ ] Subscription tier handling

#### 4.2 Content Library (Songs)
- [ ] CRUD operations for songs
- [ ] Lyrics editor with line parsing
- [ ] Bulk import functionality
- [ ] Search and filter
- [ ] Tag/category system

#### 4.3 Event Management
- [ ] Create/edit events
- [ ] Setlist builder (drag-and-drop)
- [ ] Event status management (draft/live/ended)
- [ ] Event scheduling
- [ ] Duplicate event functionality

#### 4.4 Live Presentation Views
- [x] Operator Dashboard (Partial):
  - [x] Real-time transcription display (Ghost Text component) ✅
  - [x] Connection status with RTT monitoring ✅
  - [x] Weak Signal badge for degraded connections ✅
  - [ ] Current slide preview
  - [x] Manual controls (next/previous) ✅
  - [x] Audio level meter ✅
  - [x] Match confidence display (MatchStatus component) ✅
- [ ] Audience View:
  - [ ] Full-screen slide display
  - [ ] Smooth transitions
  - [ ] Glassmorphism styling
  - [ ] Responsive design

#### 4.5 State Management (Zustand)
- [x] Auth store ✅
- [ ] Songs store
- [ ] Events store
- [ ] Live session store
- [x] WebSocket connection store ✅ (via useWebSocket hook)
- [x] Slide cache store ✅ (`slideCache` for local caching and preloading)

---

### **Phase 5: Content Import Integration** (Post-Launch)

#### 5.1 CCLI SongSelect API Integration
- [ ] Apply for CCLI Developer Partner program
- [ ] Implement OAuth 2.0 flow for CCLI account connection
- [ ] Build search interface for CCLI SongSelect catalog
- [ ] Import songs with formatted lyrics (automatic stanza breaks)
- [ ] Store CCLI OAuth tokens securely (encrypted)
- [ ] Handle API rate limits and errors gracefully
- [ ] Fallback to manual entry if API unavailable

**Benefits:**
- Eliminates manual lyric entry (major time saver)
- Automatic stanza formatting (solves parsing issues)
- Includes CCLI number automatically
- Legal compliance handled by churches' existing CCLI licenses
- Industry-standard tool churches already trust

**Estimated Timeline:** 2-3 weeks post-launch (after MVP stabilization)

**See:** `CCLI_SONGSELECT_INTEGRATION.md` for detailed specification

---

### **Phase 5: Testing & Optimization** ✅ Complete

#### 5.1 Testing Strategy ✅
- [x] Unit tests for fuzzy matching algorithm ✅ (14 tests)
- [x] Integration tests for WebSocket protocol ✅ (16 tests)
- [x] Unit tests for Event Service ✅ (15 tests)
- [x] Unit tests for STT Service ✅ (19 tests)
- [x] Unit tests for WebSocket Handler ✅ (19 tests)
- [x] Unit tests for Song Editor Modal ✅ (21 tests)
- [x] Unit tests for Setlist Builder ✅ (27 tests)
- [x] E2E framework configured (Playwright) ✅
- [ ] E2E tests for critical user flows (Pending)
- [ ] Load testing (50 concurrent connections) (Pending)

**Total: 147 passing tests (131 unit + 16 integration)**

#### 5.2 Performance Optimization
- [ ] Latency profiling (< 500ms end-to-end)
- [ ] WebSocket message optimization
- [ ] Database query optimization
- [ ] Frontend bundle size optimization
- [ ] Caching strategies

#### 5.3 Error Handling & Resilience
- [x] Graceful degradation ✅ (RTT monitoring, degraded mode detection, slide caching)
- [x] Connection retry logic ✅ (Exponential backoff in WebSocket client)
- [x] Weak Signal detection ✅ (RTT > 500ms triggers visual warning)
- [x] Slide preloading for offline resilience ✅
- [ ] Error boundaries (React)
- [ ] User-friendly error messages
- [x] Logging and monitoring ✅ (Backend logging implemented)

---

### **Phase 6: Production Readiness**

#### 6.1 Security
- [ ] RLS policies review
- [ ] API rate limiting
- [ ] Input validation
- [ ] CORS configuration
- [ ] Environment variable security

#### 6.2 Deployment
- [x] Frontend deployment (Vercel) ✅ - Live at [www.parleap.com](https://www.parleap.com)
- [x] Backend deployment (Railway) ✅ - Live at [parleapbackend-production.up.railway.app](https://parleapbackend-production.up.railway.app)
- [x] Frontend environment configuration ✅
- [x] Backend environment configuration ✅
- [x] Custom domain setup (www.parleap.com) ✅
- [x] SSL certificates active ✅
- [ ] Database migrations (Supabase recovery pending)
- [x] CI/CD pipeline (GitHub Actions) ✅

#### 6.3 Documentation ✅ Partial
- [ ] API documentation
- [x] WebSocket protocol documentation ✅ (Types and handlers documented)
- [ ] User guide
- [x] Developer setup guide ✅ (README, QUICK_START, ENV_SETUP)
- [ ] Architecture diagrams
- [x] Testing documentation ✅ (TESTING_QA_PLAN, TESTING_QUICK_START, TESTING_INFRASTRUCTURE_COMPLETE)
- [x] Session summaries ✅ (Dec 2025 - Jan 2026)

---

### **Phase 7: Content Import Integration** (Post-Launch)

#### 7.1 CCLI SongSelect API Integration
- [ ] Apply for CCLI Developer Partner program
- [ ] Implement OAuth 2.0 flow for CCLI account connection
- [ ] Build search interface for CCLI SongSelect catalog
- [ ] Import songs with formatted lyrics (automatic stanza breaks)
- [ ] Store CCLI OAuth tokens securely (encrypted)
- [ ] Handle API rate limits and errors gracefully
- [ ] Fallback to manual entry if API unavailable

**Benefits:**
- Eliminates manual lyric entry (major time saver)
- Automatic stanza formatting (solves parsing issues)
- Includes CCLI number automatically
- Legal compliance handled by churches' existing CCLI licenses
- Industry-standard tool churches already trust

**Estimated Timeline:** 2-3 weeks post-launch (after MVP stabilization)

**See:** `CCLI_SONGSELECT_INTEGRATION.md` for detailed specification

---

## 🏗️ Technical Architecture

### Data Flow
```
Browser Mic → Frontend (MediaRecorder) 
  → WebSocket → Backend (Express/ws)
    → STT Provider (Google/ElevenLabs)
      → Transcription → Fuzzy Matching
        → Supabase (Setlist Cache)
          → Match Found → WebSocket
            → Frontend (Display Update)
```

### Key Components

**Frontend:**
- Next.js 14 App Router
- Zustand (State)
- WebSocket Client
- MediaRecorder API
- Shadcn/UI Components

**Backend:**
- Express.js Server
- WebSocket Server (`ws`)
- STT Integration
- Fuzzy Matching Engine
- Supabase Client

**Infrastructure:**
- Supabase (Auth, DB, Storage)
- STT Provider (Google/ElevenLabs)

---

## 📊 Success Metrics

- **Latency:** < 500ms end-to-end (audio → display)
- **Accuracy:** > 85% match confidence
- **Reliability:** Handle 50+ concurrent connections
- **Uptime:** 99.9% availability

---

## 🚀 Next Steps (Immediate)

1. **Fix npm dev script** ✅ (Using npm-run-all)
2. **Install dependencies:** `npm install`
3. **Set up Supabase project**
4. **Create database schema**
5. **Initialize Supabase clients**

---

## 📝 Notes

- Use strict TypeScript (no `any`)
- Optimize for sub-500ms latency
- Dark mode + Glassmorphism UI
- Always implement RLS policies
- Test with simulated audio before live events

---

## 🚀 Future Features

### Smart Bible Listen (Cost Optimization)
**Status:** 📋 Documented - Ready for Implementation  
**Priority:** Medium  
**Complexity:** Medium-High

**Overview:**
Cost optimization feature for Bible mode that only activates STT when Bible-related content is detected, reducing API costs by 87-93% for long sermons.

**Key Features:**
- Local wake-word detection (zero API cost)
- Selective STT activation (30-second windows)
- Audio ring buffer for context capture
- Quote-only matching (opt-in)

**Documentation:** See `SMART_BIBLE_LISTEN.md` for complete specification

**Benefits:**
- Significant cost savings for 40+ minute sermons
- Maintains accuracy for Bible reference detection
- Operator can toggle "Always Listen" mode if needed

### Background visuals for projector view
**Status:** 📋 Roadmap  
**Priority:** Medium  
**Complexity:** Medium

Optional background layer behind the lyric/verse content on the projector/audience display: static images, looped video, or subtle motion (e.g. gradients, low-motion loops). Inspiration: ProPresenter/ProContent-style curated libraries (motion graphics, cinematic clips); ParLeap would support operator-selectable background per event or per slide (image/URL), with possible integration to a media library or stock. Performance constraint: no frame drops on projector output. No commitment to a specific asset source. See `BACKGROUND_AND_ANNOUNCEMENTS_ROADMAP.md`.

### Announcement slides and Ideogram AI
**Status:** 📋 Roadmap  
**Priority:** Medium  
**Complexity:** Medium-High

**Announcement slide type:** In addition to songs, verses, and MEDIA, support announcement items where operators add one or more slides (images, graphics, video, pictures), shown in sequence and advanced manually or by setlist position.

**Ideogram AI (optional):** Allow operators to create an announcement slide from a text prompt (e.g. "Welcome to our Easter service"); call [Ideogram API](https://developer.ideogram.ai/) to generate image (Ideogram 3.0, optional transparent background); store result (e.g. Supabase Storage) and add as a slide. API is pay-as-you-go; implementation would add prompt UI, backend proxy for API key safety, and storage of generated image URL in the announcement item. See `BACKGROUND_AND_ANNOUNCEMENTS_ROADMAP.md`.

### Expand projector font options
**Status:** 📋 Roadmap  
**Priority:** Low  
**Complexity:** Low-Medium

Today the projector uses eight Google Fonts (Inter, DM Sans, Manrope, etc.) from `frontend/lib/projectorFonts.ts`. Roadmap: expand options e.g. via Google Fonts API (load more families on demand, font picker in operator/event settings) or other font providers (Adobe Fonts, Fontshare, self-hosted) for branding flexibility. Keep implementation flexible (font family ID + optional provider or URL).

---

**Last Updated:** February 6, 2026
**Status:** Phases 1-5 Complete - Testing Infrastructure Operational ✅  
**Production Status:** Fully operational with 147+ tests, CI/CD pipeline, and comprehensive QA ✅

## 📋 Completed Phases Summary

| Phase | Description | Status | Tests |
|-------|-------------|--------|-------|
| 1 | Foundation & Infrastructure | ✅ Complete | - |
| 2 | Real-Time Engine | ✅ Complete | - |
| 3 | Predictive Matching | ✅ Complete | 14 |
| 4 | Frontend Features | ✅ Partial | 48 |
| 5 | Testing & QA | ✅ Complete | 147 |
| 6 | Production Readiness | ⏳ In Progress | - |

## 🎯 Latency Attack Summary

**Completed Features:**
1. **Latenc-o-meter**: Dev tool measuring latency at every pipeline stage
2. **Ghost Text**: Real-time transcription display for operator trust
3. **RTT Monitoring**: Continuous connection quality monitoring with degraded mode detection
4. **Slide Caching**: Local browser caching and preloading for resilience

**Key Metrics:**
- All server responses include timing metadata
- RTT monitored continuously (5-second intervals)
- Next 3 slides always preloaded locally
- Weak Signal badge appears at RTT > 500ms

**Next Steps:**
1. **Phase 1.2:** Supabase Integration (Foundation)
   - Set up Supabase project and database schema
   - Replace mock data with real queries
   - Initialize Supabase clients
2. **Phase 2.3:** Audio Capture (Frontend)
   - Browser microphone access
   - Audio streaming to WebSocket
   - Visual feedback components
3. **Phase 2.4:** STT Integration (AI Processing)
   - Choose STT provider (Google/ElevenLabs)
   - Integrate streaming transcription
   - Real-time transcription pipeline
4. **Phase 3:** Fuzzy Matching Algorithm
   - Implement string similarity matching
   - Auto-advance slide logic
   - Performance optimization

**See [NEXT_PHASE_PLAN.md](./NEXT_PHASE_PLAN.md) for detailed implementation plan.**

