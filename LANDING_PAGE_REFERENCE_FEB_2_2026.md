# Landing Page Reference - February 2, 2026

## ⚠️ CRITICAL: DO NOT CHANGE WITHOUT USER APPROVAL

**Date Established:** February 2, 2026  
**Status:** ✅ **FINAL REFERENCE STATE - DO NOT MODIFY**

---

## Important Notice

**This is the day we messed up our landing page and we don't do it again.**

The landing page style established on February 2, 2026 is the **DEFINITIVE REFERENCE**. Any changes to the landing page design, colors, gradients, or Spline background **MUST** be approved by the user before implementation.

**Rule:** Landing page should not change at any cost without explicit user verification and approval.

---

## Exact Landing Page Configuration (Feb 2, 2026)

### 1. Background Gradient (`frontend/app/globals.css`)

**Exact CSS:**
```css
body {
  background: linear-gradient(to bottom, #1a0f0a 0%, #1a0f0a 30%, #0f0a1a 60%, #0a0f1a 80%, #000a1a 100%);
  min-height: 100vh;
}
```

**Gradient Breakdown:**
- **0% - 30%**: `#1a0f0a` - Brownish/reddish-brown (extends further down)
- **30% - 60%**: Transition from brown to `#0f0a1a` (brown-blue mix)
- **60% - 80%**: `#0a0f1a` - Dark blue
- **80% - 100%**: `#000a1a` - Darker blue at bottom

**Visual Description:**
- Brown/orange mix extends down more (to 30% instead of stopping immediately)
- Smooth transition through intermediate color stops
- Blue gets progressively darker as you scroll down
- Creates a beautiful fade effect from brown at top to dark blue at bottom

### 2. Spline Background (`frontend/components/landing/HeroSection.tsx`)

**Spline URL:** `https://prod.spline.design/kzdIEyudaZu1oiNQ/scene.splinecode`

**Type:** Mouse follow effect (NOT the robot design)

**Implementation:**
- Uses `<SplineViewer>` component
- Only visible in hero section
- Has gradient overlays for seamless merge with header and next section

### 3. Hero Section Structure

**Layout:**
- 2-column grid (text left, empty right to show Spline)
- No 3D mockup in right column
- Gradient overlays:
  - Top: `from-black/25` (merges with header)
  - Bottom: `h-80` fade to next section

### 4. LyricsWall Section

**Background:** Inherits body gradient (NO separate background, NO orange effect)

**Styling:**
- Original glass cards (`bg-white/5`, `backdrop-blur-md`)
- No additional background overlays
- Clean, inherits the gradient from body

### 5. Main Container (`frontend/app/page.tsx`)

**Class:** `min-h-screen` (simple, no gradient classes)

---

## What NOT to Do

1. ❌ **DO NOT** change the gradient colors without asking
2. ❌ **DO NOT** switch Spline designs without approval
3. ❌ **DO NOT** add/remove gradient overlays without verification
4. ❌ **DO NOT** modify background styles without user confirmation
5. ❌ **DO NOT** restore to previous states without checking this document first

## What TO Do

1. ✅ **ALWAYS** ask user before making landing page changes
2. ✅ **ALWAYS** verify with user before committing landing page modifications
3. ✅ **ALWAYS** reference this document when user asks about landing page state
4. ✅ **ALWAYS** restore to this exact configuration if user requests "restore landing page"

---

## Restoration Instructions

If user asks to restore the landing page to "Feb 2nd 2026 state" or "reference state":

1. **globals.css** - Use exact gradient: `linear-gradient(to bottom, #1a0f0a 0%, #1a0f0a 30%, #0f0a1a 60%, #0a0f1a 80%, #000a1a 100%)`
2. **HeroSection.tsx** - Use mouse follow Spline: `kzdIEyudaZu1oiNQ`
3. **LyricWall.tsx** - No background, inherits body gradient
4. **page.tsx** - Simple `min-h-screen` class

---

## Git Commit Reference

**Commit:** `00379cc` (initial gradient restoration)  
**Commit:** `[latest]` (enhanced gradient with extended brown mix)

---

## Visual Description

- **Top:** Brownish color (`#1a0f0a`) extends down to 30% of page
- **Middle:** Smooth transition from brown to dark blue (`#0a0f1a`)
- **Bottom:** Darker blue (`#000a1a`) at the very bottom
- **Spline:** Mouse follow effect visible in hero section
- **Overall:** Beautiful fade from warm brown at top to cool dark blue at bottom

---

**Last Verified:** February 2, 2026  
**Status:** ✅ Approved by user as final reference state
