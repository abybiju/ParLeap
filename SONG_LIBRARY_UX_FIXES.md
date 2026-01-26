# Song Library UX Fixes - January 25, 2026

## Issues Fixed

### 1. CCLI Number Validation ✅

**Status**: VERIFIED WORKING
- Schema: Already optional with `.optional().or(z.literal(''))`
- Form: Allows empty submission
- Server Actions: Handles `null` values gracefully (converts empty string to `null`)
- Database: `ccli_number` column is nullable

**Result**: Can save songs without CCLI number.

---

### 2. Stanza Parser - Multiple Cards ✅

**Problem**: Lyrics pasted as one large block instead of splitting into multiple stanzas.

**Root Cause**: Parser wasn't properly handling various line ending formats from different sources (Windows \r\n, Mac \n, pasted text).

**Solution Implemented**:

#### Updated `parseStanzas()` function:
```typescript
// Normalize line endings (handle \r\n from different OS/pastes)
const normalized = lyrics.replace(/\r\n/g, '\n');

// Split on double newlines or more (blank lines between stanzas)
// Regex: \n followed by any whitespace, followed by \n
const rawStanzas = normalized.split(/\n\s*\n+/);

// Filter and parse - only include non-empty stanzas
return rawStanzas
  .map(stanza => {
    const lines = stanza
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);
    return lines.length > 0 ? lines : null;
  })
  .filter((stanza): stanza is string[] => stanza !== null);
```

**What Changed**:
- ✅ Handles Windows line endings (\r\n)
- ✅ Handles multiple blank lines between stanzas
- ✅ Properly trims whitespace
- ✅ Filters out empty lines and empty stanzas
- ✅ Type-safe filtering with TypeScript

**Result**: Can paste lyrics with any line ending format and get proper stanza separation.

---

### 3. Preview UX Enhancement ✅

**Enhanced `SongPreviewCards`**:
- Added helper text: "Separate stanzas with blank lines (press Enter twice)"
- Improved glassmorphism styling with shadows
- Better badge styling (indigo theme)
- Smooth transitions and hover effects
- Scrollable preview area
- Added padding adjustment for scrollbar

**Result**: Users understand how to separate stanzas visually.

---

## How to Use

### Creating a Song

1. **Click "New Song"** on `/songs` page
2. **Fill in fields**:
   - Title: Required
   - Artist: Optional
   - CCLI #: Optional (can be left blank)
3. **Paste lyrics in left panel**:
   - Separate stanzas by pressing **Enter twice** (creates blank line)
   - Each stanza will instantly appear as a separate card on the right
4. **Watch live preview**:
   - Each stanza becomes a "Slide" card
   - Line count displayed on each card
5. **Click "Create Song"**:
   - Saves immediately
   - Draft is cleared
   - Toast notification shows success

### Example Paste Format

```
Amazing grace how sweet the sound
That saved a wretch like me
I once was lost but now I'm found
Was blind but now I see

'Twas grace that taught my heart to fear
And grace my fears relieved
How precious did that grace appear
The hour I first believed
```

(Note the blank line between the two stanzas)

---

## Testing

### Test Case 1: Paste with Windows Line Endings
- Copy lyrics from Word/Google Docs (often have \r\n)
- Paste into lyrics field
- ✅ Should split into multiple cards

### Test Case 2: Paste with Unix Line Endings
- Copy from GitHub/terminal
- Paste into lyrics field
- ✅ Should split into multiple cards

### Test Case 3: Empty CCLI Field
- Leave CCLI # blank
- Click "Create Song"
- ✅ Should save without errors

### Test Case 4: Single Stanza
- Paste lyrics with no blank lines
- ✅ Should show as single Slide card

---

## Files Modified

1. **frontend/lib/schemas/song.ts**
   - Enhanced `parseStanzas()` function
   - Better regex for blank line detection
   - Improved type safety

2. **frontend/components/songs/SongPreviewCards.tsx**
   - Enhanced visual styling
   - Added helper text
   - Better glassmorphism effects
   - Improved badge styling

3. **frontend/app/songs/actions.ts**
   - ✅ Already handles null values correctly (no changes needed)

---

## Verification

- ✅ TypeScript type check passes
- ✅ All components compile
- ✅ Schema validation working
- ✅ Server actions handle edge cases
- ✅ Git commit: `ea819de`

---

## Next Steps

1. **Test in development**: `http://localhost:3000/songs`
2. **Deploy to production**: Code will auto-deploy to Vercel
3. **User testing**: Have users paste real lyrics to verify stanza splitting
4. **Monitor**: Check Supabase for any null value issues

---

**Status**: Ready for production ✅
