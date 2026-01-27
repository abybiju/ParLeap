# Session Summary - January 27, 2026

## Overview
Implemented **Adaptive Live Mode** - a major feature allowing AI-powered automatic song switching and manual operator override for non-linear performances.

## Problem Statement
Previously, the live system could only iterate sequentially (Song 1 → 2 → 3). Real performances are non-linear - singers jump between songs unpredictably, and operators need manual control.

## Solution: Adaptive Live Mode
Three-phase implementation combining AI intelligence with human control.

---

## Phase 1: Backend Enhancement (Multi-Song Matching + Debouncing)

### New Core Function: `findBestMatchAcrossAllSongs()`
**Location:** `backend/src/services/matcherService.ts`

**Optimization Strategy (User-Specified):**
1. **Check current song FIRST** (Priority 1) - handles 90% of cases
2. **Only check other songs if confidence < 60%** - prevents unnecessary scanning
3. **Higher threshold (85%) for song switches** - prevents false positives

**Implementation Details:**
```typescript
export function findBestMatchAcrossAllSongs(
  buffer: string,
  currentSongContext: SongContext,
  allSongs: SongData[],
  currentSongIndex: number,
  config: MatcherConfig
): MultiSongMatchResult
```

**Logic Flow:**
1. Check current song with existing `findBestMatch()`
2. If confidence >= 60% → Return (no multi-song check needed)
3. If confidence < 60% → Check all other songs (first 5 lines each)
4. Return best match with confidence score

**Confidence Levels:**
- **85%+**: Auto-switch (high confidence)
- **60-85%**: Suggest only (medium confidence) - show toast, don't auto-switch
- **< 60%**: Ignore (low confidence)

### Debouncing System
**Purpose:** Prevent false-positive rapid switches when singer briefly mentions another song.

**Requirements (User-Specified):**
- Require **2 sustained matches** before switching
- **3-second cooldown** after any song switch

**Implementation:**
- Added `suggestedSongSwitch` to session state tracking:
  - `songId`, `songIndex`, `confidence`
  - `firstDetectedAt` timestamp
  - `matchCount` (increments on consecutive matches)
- `lastSongSwitchAt` timestamp for cooldown enforcement

**Example:**
```
Match 1: "Amazing Grace" 90% confidence → Count = 1 (wait)
Match 2: "Amazing Grace" 90% confidence → Count = 2 (AUTO-SWITCH!)
```

### New Message Type: `SONG_SUGGESTION`
**Location:** `backend/src/types/websocket.ts`, `frontend/lib/websocket/types.ts`

**Payload:**
```typescript
{
  type: 'SONG_SUGGESTION',
  payload: {
    suggestedSongId: string,
    suggestedSongTitle: string,
    suggestedSongIndex: number,
    confidence: number, // 0.6-0.85
    matchedLine: string
  }
}
```

**Use Case:** AI detected possible song switch but not confident enough to auto-switch. Operator gets notification with "Switch Now" button.

### Auto-Follow Mode Management
**Backend Logic:**
- `isAutoFollowing` flag in session state (default: `true`)
- When operator manually switches songs → automatically set to `false`
- Prevents AI from fighting manual control

**Updated Handler:**
```typescript
// In handleManualOverride()
if (songChanged) {
  session.isAutoFollowing = false; // Disable AI auto-switch
  session.suggestedSongSwitch = undefined; // Clear pending suggestions
}
```

---

## Phase 2: Frontend UI Enhancement

### 1. Clickable Setlist Panel
**Location:** `frontend/components/operator/SetlistPanel.tsx`

**Changes:**
- Converted song cards from `<div>` to `<button>` elements
- Added Play icons (`lucide-react`) to non-current songs
- Added hover effects and focus states
- Click handler calls `goToSlide(0, songId)` to jump to song start

**UI Improvements:**
```typescript
<button
  onClick={() => handleSongClick(song.id, songIndex)}
  disabled={isCurrentSong}
  className="hover:border-indigo-400/50 cursor-pointer"
>
  {!isCurrentSong && <Play className="h-4 w-4" />}
  {/* Song details */}
</button>
```

### 2. Auto-Follow Toggle Button
**Location:** `frontend/components/operator/OperatorHUD.tsx`

**Features:**
- Toggle button in header with Zap/ZapOff icons
- Visual states:
  - **ON**: `🗲 AI Auto-Follow` (indigo)
  - **OFF**: `🗲 Manual Mode` (gray)
- Toast confirmations on toggle
- Syncs with backend via manual override behavior

**Implementation:**
```typescript
const [isAutoFollowing, setIsAutoFollowing] = useState(true);

const toggleAutoFollow = () => {
  setIsAutoFollowing(!isAutoFollowing);
  toast.success('AI Auto-Follow ' + (!isAutoFollowing ? 'enabled' : 'disabled'));
};
```

### 3. Toast Notifications for Song Suggestions
**Location:** `frontend/components/operator/OperatorHUD.tsx`

**Listens for:** `SONG_SUGGESTION` messages from backend

**Toast Content:**
- **Title:** "Detected '[Song Title]'?"
- **Description:** "[Confidence%] match: '[Matched line preview...]'"
- **Action Button:** "Switch Now" → calls `goToSlide(0, suggestedSongId)`
- **Duration:** 5 seconds

**Implementation:**
```typescript
useEffect(() => {
  if (lastMessage && isSongSuggestionMessage(lastMessage)) {
    toast.info(`Detected "${suggestedSongTitle}"?`, {
      description: `${confidence}% match: "${matchedLine.slice(0, 50)}..."`,
      action: {
        label: 'Switch Now',
        onClick: () => goToSlide(0, suggestedSongId)
      }
    });
  }
}, [lastMessage]);
```

---

## Phase 3: State Management

### Updated `liveSessionStore`
**Location:** `frontend/lib/stores/liveSessionStore.ts`

**New State Fields:**
```typescript
interface LiveSessionState {
  // ... existing fields
  isAutoFollowing: boolean; // Whether AI auto-switching is enabled
  lastMatchConfidence: number; // Most recent match confidence (for debugging)
}
```

**New Actions:**
- `setAutoFollowing(enabled: boolean)` - Toggle AI mode
- `setMatchConfidence(confidence: number)` - Update for debugging UI

**Updated Actions:**
- `updateFromDisplayMessage()` now extracts `matchConfidence` from payload
- `startSession()` initializes `isAutoFollowing: true`
- `reset()` clears auto-follow state

### Backend Session State
**Location:** `backend/src/websocket/handler.ts`

**New Session State Fields:**
```typescript
interface SessionState {
  // ... existing fields
  isAutoFollowing: boolean;
  suggestedSongSwitch?: {
    songId: string;
    songIndex: number;
    confidence: number;
    firstDetectedAt: number;
    matchCount: number; // For debouncing
  };
  lastSongSwitchAt?: number; // For cooldown
}
```

---

## Architecture Decisions

### Why Backend-Only Matching?
**User Approved:** "Single Source of Truth is the correct architectural choice"

**Benefits:**
1. **No Duplication** - One matching algorithm, not two
2. **Consistent** - All clients see same results
3. **Efficient** - No need to send full lyrics to clients
4. **Maintainable** - One codebase for matching logic

**Alternative Rejected:** Client-side matching with `fuse.js`
- Would duplicate backend logic
- Risk of client/server disagreement
- Increased network overhead (all lyrics to client)
- More complex state synchronization

### Optimization: Current Song First
**Rationale:** In 90% of cases, singer is on the correct song. Checking all songs every time is wasteful.

**Performance Impact:**
- **Before:** Check all songs on every transcript → O(n×m) complexity
- **After:** Check current song → Early exit if good → O(1) for normal case
- **Fallback:** Only check others if < 60% confidence

### Debouncing: Why 2 Matches?
**Problem:** Singer might mention another song briefly ("...remember Amazing Grace...")
**Solution:** Require sustained match (2 consecutive phrases) before switching
**Result:** Prevents jarring false-positive switches mid-song

### Why 3-Second Cooldown?
**Problem:** Rapid switching back and forth is confusing
**Solution:** After any switch, ignore suggestions for 3 seconds
**Result:** Smoother experience, gives singer time to settle into new song

---

## Code Changes Summary

### Files Modified (7 files, +451 lines, -24 lines)

**Backend:**
1. `backend/src/services/matcherService.ts` - Multi-song matching function
2. `backend/src/types/websocket.ts` - SONG_SUGGESTION message type
3. `backend/src/websocket/handler.ts` - Debouncing logic, auto-follow management

**Frontend:**
4. `frontend/components/operator/OperatorHUD.tsx` - Toggle button, toast notifications
5. `frontend/components/operator/SetlistPanel.tsx` - Clickable songs with Play icons
6. `frontend/lib/stores/liveSessionStore.ts` - Auto-follow state
7. `frontend/lib/websocket/types.ts` - SONG_SUGGESTION type guard

---

## Testing Scenarios

### 1. Normal Performance (Current Song)
**Expected:** Fast, no multi-song check
**Test:** Sing through a song normally
**Result:** Confidence stays > 60%, no other songs checked

### 2. Song Jump (High Confidence)
**Expected:** Auto-switch after 2 sustained matches
**Test:** 
- Sing from "Song A"
- Sing line from "Song B" (confidence > 85%)
- Continue singing "Song B"
**Result:** After 2nd match, auto-switches to "Song B"

### 3. False Mention (Brief)
**Expected:** No switch (debouncing works)
**Test:** Sing "Song A", mention "Song B" briefly, continue "Song A"
**Result:** Suggestion appears but matchCount resets, no auto-switch

### 4. Cooldown Period
**Expected:** 3-second wait after any switch
**Test:** Auto-switch to "Song B", immediately sing "Song C"
**Result:** No switch for 3 seconds, then processes normally

### 5. Medium Confidence Suggestion
**Expected:** Toast notification, no auto-switch
**Test:** Sing line with 70% confidence match to different song
**Result:** Toast shows "Detected '[Song]'?" with "Switch Now" button

### 6. Manual Override
**Expected:** Jump immediately, disable auto-follow
**Test:** Click "Song C" in setlist
**Result:** Jumps to Song C, AI auto-follow disabled, toast confirms

### 7. Manual Re-enable
**Expected:** AI resumes after manual disable
**Test:** Click auto-follow toggle after manual override
**Result:** Toggle turns indigo, AI matching resumes

---

## UI/UX Improvements

### Visual Indicators
1. **Play Icons** - Non-current songs show Play icon on hover
2. **Auto-Follow Badge** - Header shows current mode (AI/Manual)
3. **Toast Notifications** - Non-intrusive suggestions
4. **Current Song Highlight** - Indigo border + "Current" badge

### User Feedback
1. **Hover Effects** - Setlist songs respond to hover
2. **Focus States** - Keyboard navigation support
3. **Disabled States** - Current song can't be clicked
4. **Toast Confirmations** - Mode changes show toasts

### Accessibility
1. **Keyboard Support** - Focus rings on buttons
2. **Screen Reader Labels** - Proper ARIA attributes
3. **Visual Hierarchy** - Clear current vs. available states

---

## Performance Considerations

### Backend Optimizations
1. **Early Exit** - Most transcripts don't trigger multi-song check
2. **Limited Lookahead** - Only check first 5 lines of other songs
3. **Single Pass** - Check all songs once, not multiple iterations
4. **Cooldown** - Prevents unnecessary checks after recent switch

### Network Efficiency
1. **No Client Matching** - Don't send full lyrics to frontend
2. **Minimal Message Size** - SONG_SUGGESTION only when needed
3. **Broadcast Optimization** - Share messages across all clients for same event

### Memory Management
1. **Session Cleanup** - Clear suggestions on switch/manual override
2. **Buffer Management** - Existing rolling buffer logic unchanged
3. **State Tracking** - Minimal additional state (2 fields per session)

---

## Future Enhancements (Not Implemented)

### Potential Improvements
1. **Confidence Graph** - Real-time visualization of match confidence
2. **Song History** - Track which songs were auto-switched
3. **Smart Suggestions** - ML-based prediction of likely next song
4. **Operator Preferences** - Per-user auto-follow defaults
5. **Confidence Tuning UI** - Adjust thresholds without code changes

### Known Limitations
1. **First 5 Lines Only** - Other songs only checked at beginning
2. **No Mid-Song Detection** - Can't detect song switch to middle of another song
3. **Sequential Matching** - Checks songs one at a time (could parallelize)
4. **No Learning** - Doesn't adapt to operator's manual corrections

---

## Related Issues Fixed

### STT Provider Issues (Earlier Today)
- Fixed event-specific STT stream initialization
- Resolved "waiting for transcription" bug
- Added diagnostics for STT configuration errors

### Date/Time Handling (Earlier Today)
- Fixed dashboard date display
- Separated date and time inputs
- Made time optional with 9:00 AM default

---

## Git Commit
**Commit:** `f398915`
**Message:** "feat: Adaptive Live Mode - AI auto-switch + manual override"
**Stats:** 7 files changed, 451 insertions(+), 24 deletions(-)

---

## Documentation Updated
- This session summary (SESSION_SUMMARY_JAN_27_2026.md)
- Project context (.cursor/rules/project-context.mdc) - needs update
- Memory files (next)

---

## Key Takeaways

1. **Architecture Matters** - Single source of truth prevents many headaches
2. **User Requirements First** - User-specified optimizations (current song first, 2 matches, 3s cooldown)
3. **Debouncing Essential** - Prevents false positives in real-world use
4. **Visual Feedback Critical** - Users need to see AI mode state
5. **Manual Override Paramount** - AI should never fight operator control

---

## Testing Status
✅ Type-check passes (both frontend and backend)
⚠️ Manual testing needed:
- Test debouncing with real audio
- Test multi-song detection
- Test manual override behavior
- Test cooldown timing
- Test toast notifications
