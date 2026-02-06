# Smart Bible Listen Feature Specification

**Status:** 📋 Documented (Future Implementation)  
**Date:** February 6, 2026  
**Priority:** Medium (Cost Optimization)  
**Complexity:** Medium-High

---

## Problem Statement

### Current State
- Bible mode currently runs ElevenLabs STT continuously for the entire session
- For a 40-minute sermon, this means 2,400 seconds of STT processing
- High API costs accumulate even when speaker is not referencing Bible content
- User concern: "I don't want my AI token to get finished by listening to all of his words"

### Goal
- Only activate STT when Bible-related content is detected
- Maintain accuracy for Bible reference detection
- Significantly reduce API costs for long sermons

### Core Challenge
**The Chicken-and-Egg Problem:**
- To detect Bible references ("Luke 2:13") → need STT running
- To detect quote-only phrases ("weeping and gnashing of teeth") → need STT running
- But STT costs money for every second it runs

**Solution:** Two-stage hybrid system with local wake-word detection

---

## Solution Architecture

### Two-Stage Hybrid System

#### Stage 1: Local Wake-Word Detection (Zero API Cost)
- **Location:** Browser (Frontend)
- **Technology:** Lightweight local keyword spotting
- **Cost:** $0 (runs entirely in browser)
- **Purpose:** Detect Bible-related wake words/phrases before activating STT

#### Stage 2: Selective STT Window (Controlled Cost)
- **Location:** Backend
- **Technology:** ElevenLabs STT (on-demand activation)
- **Cost:** Only when wake word detected
- **Purpose:** Capture full Bible reference with high accuracy

### Audio Ring Buffer
- Maintains last 8-12 seconds of audio in browser memory
- Not sent to API until wake word detected
- Ensures full reference is captured even if wake word is mid-sentence
- Example: Speaker says "In the book of Luke chapter 2 verse 13..." → ring buffer captures entire phrase

---

## Technical Design

### Wake Words & Phrases

#### Book Names (66 books + aliases)
- All canonical Bible book names: "Luke", "Romans", "Genesis", "Revelation"
- Common abbreviations: "Rev", "1 Cor", "2 Tim", "Phil"
- Numbered books: "1st John", "2nd Corinthians", "Third John"
- Reference: Uses existing `BIBLE_BOOKS` data structure

#### Wake Phrases
- "chapter" / "chap" / "ch"
- "verse" / "verses" / "v"
- "it is written"
- "scripture says"
- "the Bible says"
- "as written in"
- "according to scripture"
- "the Word says"

### Ring Buffer Implementation

**Specifications:**
- **Size:** 10 seconds of audio
- **Format:** PCM 16-bit, 16kHz, mono (same as ElevenLabs input)
- **Storage:** Browser memory (not sent to API until trigger)
- **Purpose:** Capture context before wake word

**Flow:**
```
Audio captured → Store in ring buffer → Check for wake word → If detected: Send buffer + next 30s to STT
```

### STT Activation/Deactivation Logic

#### Activation Trigger
1. Wake word detected in local detection
2. Send ring buffer (last 10s) + next 30s to ElevenLabs
3. Process transcripts for Bible references
4. If reference found → keep STT active for follow mode
5. If no reference found after 30s → shut STT off

#### Deactivation Conditions
- No Bible reference detected within 30-second window
- Operator manually disables Smart Listen
- Session ends

#### Follow Mode (After Reference Detected)
- STT remains active to track verse progression
- Auto-advances through verses as speaker reads
- Continues until:
  - Speaker stops reading Bible (no match for 30s)
  - Operator manually stops
  - Session ends

### Quote-Only Matching (Opt-In)

**Status:** Opt-in only (disabled by default)

**Why Opt-In:**
- Requires full-text matching against all ~31,000 Bible verses
- STT must be running to get quote text
- High computational cost (fuzzy matching across entire Bible)
- Expensive API usage

**Activation:**
- Toggle in Operator HUD: "Quote Search Mode"
- Only searches after a Bible reference is detected (provides context)
- Shows warning: "Quote search uses more API credits"

**Example Use Case:**
- Speaker: "There shall be weeping and gnashing of teeth"
- System searches all Bible verses for this phrase
- Returns: Matthew 8:12, Matthew 13:42, Matthew 13:50, etc.

---

## User Preferences & Decisions

### Default Behavior
- ✅ **Smart Listen enabled by default** when Bible mode is on
- Operator can disable with toggle: "Always Listen" (full STT mode)
- Shows cost savings indicator: "Saved: 2,100s of STT"

### STT Window Duration
- **Default:** 30 seconds after wake word detected
- **Configurable:** Via env var `BIBLE_SMART_LISTEN_WINDOW_MS=30000`
- **Auto-extend:** If Bible reference found, window extends for follow mode

### Quote Matching
- **Default:** Disabled (opt-in only)
- **Toggle:** "Quote Search Mode" in Operator HUD
- **Warning:** Shows cost impact when enabled

### Cost Savings Indicator
- Display in Operator HUD: "Saved: X seconds of STT"
- Calculated: Total session time - STT active time
- Updates in real-time

---

## Implementation Details

### Frontend Changes

#### 1. Local Wake-Word Detection
**File:** `frontend/lib/hooks/useBibleWakeWord.ts` (new)

```typescript
// Lightweight keyword detection
// Uses Web Speech API or pattern matching
// Maintains audio ring buffer
// Triggers STT activation when wake word detected
```

**Features:**
- Pattern matching on audio chunks (before STT)
- Or lightweight Web Speech API for basic transcription
- Maintains 10-second audio ring buffer
- Sends trigger signal to backend when wake word detected

#### 2. Audio Ring Buffer
**File:** `frontend/lib/hooks/useAudioCapture.ts` (modify)

**Changes:**
- Add ring buffer storage (10 seconds)
- Store audio chunks before sending to backend
- On wake word trigger: send buffer + next 30s
- Clear buffer after sending

#### 3. Operator HUD Toggle
**File:** `frontend/components/operator/OperatorHUD.tsx` (modify)

**New Controls:**
- "Smart Listen" toggle (enabled by default in Bible mode)
- "Quote Search Mode" toggle (disabled by default)
- Cost savings indicator

### Backend Changes

#### 1. Selective STT Activation
**File:** `backend/src/websocket/handler.ts` (modify)

**Changes:**
- Add `smartListenEnabled` flag to SessionState
- Only initialize ElevenLabs stream when:
  - Smart Listen disabled (always on), OR
  - Wake word detected (selective activation)
- Implement 30-second window timer
- Auto-shutoff if no Bible reference found

#### 2. STT Window Management
**File:** `backend/src/websocket/handler.ts` (modify)

**New Logic:**
- Track STT activation time
- Start 30-second timer on activation
- If Bible reference found → extend window
- If no reference after 30s → end STT stream

#### 3. Quote-Only Matching Service
**File:** `backend/src/services/bibleQuoteMatcher.ts` (new)

**Features:**
- Full-text search across all Bible verses
- Fuzzy matching for partial quotes
- Returns verse references with confidence scores
- Only active when quote search mode enabled

### Configuration Options

#### Environment Variables

```bash
# STT window duration (milliseconds)
BIBLE_SMART_LISTEN_WINDOW_MS=30000

# Ring buffer size (seconds)
BIBLE_SMART_LISTEN_RING_BUFFER_SEC=10

# Enable quote matching by default (not recommended)
BIBLE_QUOTE_MATCH_ENABLED=false

# Wake word detection sensitivity (0.0-1.0)
BIBLE_WAKE_WORD_SENSITIVITY=0.7
```

#### Database Schema

**No schema changes required** - uses existing:
- `events.bible_mode` (boolean)
- `events.bible_version_id` (uuid)

**Optional Enhancement:**
- Add `events.bible_smart_listen` (boolean, default: true)
- Add `events.bible_quote_search` (boolean, default: false)

---

## Cost Savings Analysis

### Current Cost (40-minute sermon)
- **STT Duration:** 40 min × 60 sec = 2,400 seconds
- **Cost:** ~$X (depends on ElevenLabs pricing per second)

### With Smart Listen (estimated)
- **Bible References:** ~5-10 references per sermon
- **STT Duration:** 5-10 references × 30s = 150-300 seconds
- **Cost Reduction:** 87-93% savings

### Example Calculation
```
40-minute sermon:
- Total time: 2,400 seconds
- Smart Listen active: 300 seconds (5 references × 30s + follow mode)
- Savings: 2,100 seconds (87.5% reduction)
```

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│ Browser (Frontend)                                          │
│                                                             │
│  ┌────────────────────────────────────────────────────┐   │
│  │ Local Wake-Word Detector (Stage 1)                  │   │
│  │ - Pattern matching on audio chunks                   │   │
│  │ - Or lightweight Web Speech API                     │   │
│  │ - Audio ring buffer (10s)                          │   │
│  └────────────────────────────────────────────────────┘   │
│                          │                                  │
│                          │ Wake word detected               │
│                          ▼                                  │
│  ┌────────────────────────────────────────────────────┐   │
│  │ Send: Ring Buffer + Next 30s → Backend            │   │
│  └────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│ Backend                                                     │
│                                                             │
│  ┌────────────────────────────────────────────────────┐   │
│  │ ElevenLabs STT Stream (Stage 2)                     │   │
│  │ - Active only when wake word detected               │   │
│  │ - 30s window after trigger                          │   │
│  │ - Auto-shutoff if no Bible reference found         │   │
│  └────────────────────────────────────────────────────┘   │
│                          │                                  │
│                          ▼                                  │
│  ┌────────────────────────────────────────────────────┐   │
│  │ Bible Reference Parser                               │   │
│  │ - findBibleReference()                              │   │
│  │ - If found → keep STT active for follow mode       │   │
│  │ - If not found → shut STT off                       │   │
│  └────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

---

## Future Work

### Implementation Checklist

#### Phase 1: Frontend Wake-Word Detection
- [ ] Create `useBibleWakeWord` hook
- [ ] Implement pattern matching for wake words
- [ ] Add audio ring buffer to `useAudioCapture`
- [ ] Test wake word detection accuracy
- [ ] Add UI toggle in Operator HUD

#### Phase 2: Backend Selective STT
- [ ] Add `smartListenEnabled` flag to SessionState
- [ ] Implement conditional STT initialization
- [ ] Add 30-second window timer
- [ ] Implement auto-shutoff logic
- [ ] Test STT activation/deactivation

#### Phase 3: Integration & Testing
- [ ] End-to-end testing with real sermons
- [ ] Verify cost savings calculations
- [ ] Test edge cases (rapid references, long pauses)
- [ ] Performance optimization
- [ ] UI polish (cost indicator, toggles)

#### Phase 4: Quote Matching (Optional)
- [ ] Create `bibleQuoteMatcher` service
- [ ] Implement full-text search
- [ ] Add fuzzy matching
- [ ] Add UI toggle for quote search
- [ ] Test with various quote formats

### Testing Requirements

#### Unit Tests
- Wake word detection accuracy
- Ring buffer management
- STT window timing
- Cost calculation logic

#### Integration Tests
- End-to-end flow: Wake word → STT → Reference detection
- Multiple references in sequence
- Long pauses between references
- Quote matching (if implemented)

#### Performance Tests
- Wake word detection latency (<100ms)
- STT activation time (<500ms)
- Memory usage (ring buffer)
- Cost savings verification

### Rollout Strategy

1. **Beta Testing**
   - Enable for select users
   - Monitor cost savings
   - Gather feedback on accuracy

2. **Gradual Rollout**
   - Enable by default for new sessions
   - Keep "Always Listen" option available
   - Monitor error rates

3. **Full Release**
   - Default enabled for all Bible mode sessions
   - Document cost savings
   - Add to user guide

---

## Related Documentation

- `backend/src/services/bibleService.ts` - Bible reference parsing
- `backend/src/websocket/handler.ts` - STT stream management
- `frontend/lib/hooks/useAudioCapture.ts` - Audio capture hook
- `ENV_SETUP_STT.md` - STT configuration guide

---

## Notes

- **Status:** Feature is documented but not yet implemented
- **Priority:** Medium (cost optimization, not critical path)
- **Complexity:** Medium-High (requires frontend + backend coordination)
- **Risk:** Low (can fallback to always-on STT if issues occur)

---

**Last Updated:** February 6, 2026  
**Documented By:** ParLeap AI Assistant  
**Next Review:** When implementation begins
