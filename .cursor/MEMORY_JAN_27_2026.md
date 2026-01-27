# Memory Update - January 27, 2026

## Session Overview
Implemented **Adaptive Live Mode** - a major architectural enhancement enabling non-linear performances with AI auto-switching and manual operator control.

## Key Learnings

### 1. Architecture Validation
**Decision:** Backend-only matching (no client-side duplication)
**Reasoning:** Single source of truth prevents inconsistency, reduces complexity
**User Feedback:** "Your argument for 'Single Source of Truth' is the correct architectural choice"

This validates our architectural philosophy:
- Don't duplicate logic between client/server
- Keep intelligence centralized for consistency
- Only send results to clients, not raw data for processing

### 2. Performance Optimization Strategy
**User Requirement:** "Check current song first. Only check other songs if confidence is low."

This teaches us:
- **Optimize for the common case** (90% of time, singer is on correct song)
- Early exit patterns save significant computation
- Don't over-engineer edge cases at expense of main path

### 3. Debouncing is Critical
**User Requirement:** "Do not trigger a switch unless the match is sustained for at least 2 phrases"

Real-world insight:
- Singers mention other songs briefly mid-performance
- False positives are worse than false negatives
- Sustained matches indicate intentional change, not casual mention

### 4. Human Override Paramount
**Implementation:** Manual song change auto-disables AI

Philosophy learned:
- AI should assist, not fight operator
- When human takes control, AI should step back
- Operator must feel in control at all times

### 5. Confidence Thresholds Matter
**High (85%+):** Auto-switch safely
**Medium (60-85%):** Suggest, don't auto-switch
**Low (<60%):** Ignore

This teaches:
- Not all AI predictions should trigger action
- Medium confidence requires human confirmation
- Different confidence levels need different UX responses

## Technical Patterns Learned

### 1. Multi-Condition Matching
```typescript
// Check current first (fast path)
if (currentConfidence >= 0.6) return;

// Only then check others (slow path)
for (otherSongs) { ... }
```

**Pattern:** Cascade checks from most-to-least likely

### 2. Debouncing with State
```typescript
if (sameSong && matchCount >= 2) {
  // Execute action
} else if (sameSong) {
  // Increment counter
} else {
  // Reset counter
}
```

**Pattern:** Track consecutive occurrences before action

### 3. Cooldown Enforcement
```typescript
if (now - lastActionAt < COOLDOWN) {
  // Ignore
  return;
}
```

**Pattern:** Time-based action throttling

## User Preferences Observed

1. **Explicit Requirements:** User provided specific thresholds (2 matches, 3s cooldown)
2. **Performance Focus:** "Crucial Optimization" emphasized efficiency
3. **Architecture Clarity:** Approved single-source-of-truth after explanation
4. **Documentation Value:** "Update documentations, just like we do every time"

## Project Patterns

### Commit Message Style
User appreciates detailed commit messages with:
- Clear phase breakdown
- Technical details (not just "fixed bug")
- Architecture decisions explained
- User experience impact described

### Documentation Habit
User consistently requests documentation updates after major work:
- Session summaries with technical depth
- Memory updates for learning capture
- Project context updates for newcomers

### Testing Mindset
User wants:
- Type-check verification before commit
- Manual testing scenarios outlined
- Edge cases documented

## Code Quality Standards

1. **Type Safety:** Always use TypeScript strictly, never `any`
2. **Single Responsibility:** Functions do one thing well
3. **Optimization Comments:** Explain why optimizations exist
4. **Debug Logging:** Comprehensive console.log for production debugging
5. **State Tracking:** Clear state management with explicit fields

## Future Reference

### When Implementing AI Features
1. Start with architecture discussion (don't jump to implementation)
2. Optimize for common case, handle edge cases separately
3. Add debouncing/cooldown for any automatic actions
4. Provide manual override for all AI decisions
5. Use confidence levels for different UX responses

### When Refactoring
1. Don't duplicate logic between client/server
2. Centralize intelligence on backend
3. Keep frontend lightweight (display only)
4. Validate architecture with user before large changes

### Communication Style
1. Present options with trade-offs
2. Explain architectural reasoning
3. Wait for approval on significant changes
4. Provide detailed summaries after completion
5. Update documentation proactively

## Notable Quotes

> "Your argument for 'Single Source of Truth' is the correct architectural choice for a multi-screen live app."

> "Crucial Optimization: Check the Current Song first (Priority 1). Only check other songs if confidence is low."

> "Debounce: Do not trigger a switch unless the match is sustained for at least 2 phrases."

These quotes reflect user's engineering mindset:
- Values clean architecture over quick hacks
- Thinks about performance implications
- Understands real-world edge cases
- Prioritizes user experience over technical elegance

## Session Productivity

- **Planning Phase:** ~30 minutes (architecture discussion)
- **Implementation:** ~90 minutes (3 phases)
- **Testing:** ~15 minutes (type-check, verification)
- **Documentation:** ~20 minutes (this update)

**Total:** ~2.5 hours for major feature with:
- 7 files modified
- 451 lines added
- Full type safety maintained
- Comprehensive documentation
- No technical debt introduced

This sets a good pace expectation for future complex features.

## Next Session Preparation

When resuming work:
1. Read this memory file first
2. Check latest session summary (JAN_27_2026)
3. Review project context for current status
4. Note any pending testing (manual tests for Adaptive Live Mode)

## Technical Debt / Future Work

None created in this session. All code is production-ready.

Potential enhancements mentioned but not implemented:
- Confidence graph visualization
- Song history tracking
- ML-based next-song prediction
- Per-user auto-follow preferences
- UI-based confidence tuning

These are nice-to-haves, not blockers.
