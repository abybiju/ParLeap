# Replace "Ready for any song" Section — Ideas (No Album Art)

## Context

- **Section to replace:** The block that currently uses the title "Ready for any song" (e.g. BackstageLyrics, SlapLyrics, LyricWall, or SpotlightLyrics). It sits above "Every song, One flow" (WorshipStream).
- **Constraint:** No album art. Something unique and interactive instead of (or in addition to) static/scrolling lyrics.

---

## Option A: Lyric Word Cloud (Interactive Typography)

**Concept:** A cloud of worship song titles or short lyric phrases. Words are sized by emphasis; hover or mouse move highlights/scale one or several words. Optional: click a word to show a short lyric snippet in a tooltip or small card.

**Why it works:** Distinct from album art; ties to "any song" by showing many titles/phrases; interactive and scannable. Fits dark theme with soft glow on hover.

**Tech:** Client component, fixed list of 20–40 phrases/titles; absolute or flex layout with random-ish positions/sizes; Framer Motion for hover scale + optional mouse-follow highlight. No new APIs.

---

## Option B: "Flow" Scroll Line (Scroll-Driven)

**Concept:** A single horizontal or gently curved line that "draws" or reveals as the user scrolls. Song titles or short phrases appear along the path as the section enters the viewport. Literally "one flow" of content.

**Why it works:** Scroll-driven animation (CSS `scroll-timeline` or Framer `useScroll`) feels modern; no album art; reinforces "flow" messaging. Can reuse LyricWall-style content (titles/phrases).

**Tech:** SVG path or div-based line; scroll progress drives `stroke-dashoffset` or opacity of segments; text labels positioned along the path. Fallback: simple scroll-triggered fade-in of a list if `animation-timeline` support is limited.

---

## Option C: Setlist Strip (Product Teaser)

**Concept:** A short, auto-advancing or scroll-synced "setlist" strip that looks like the ParLeap UI: song names in a row with a "now playing" indicator that moves. One line of copy: e.g. "From Amazing Grace to What a Beautiful Name — one flow."

**Why it works:** Directly shows the product (setlist + flow); no album art; memorable and on-message. Can be purely visual (no real API) with 5–8 famous titles.

**Tech:** Client component; horizontal strip of song name pills; "now playing" highlight animates (CSS or Framer) on a loop or on scroll into view. Optional: pause on hover.

---

## Option D: Spotlight / Reveal (Keep Concept, New Copy)

**Concept:** Keep a lyric-reveal or spotlight interaction (e.g. mouse-follow glow on text) but **change the section title** from "Ready for any song" to something that fits the interaction (e.g. "Any song. One flow." or "From hymn to worship — one stream."). Content stays lyric lines; only the heading and maybe one line of subcopy change.

**Why it works:** Minimal build if you liked the interaction but want different messaging; no album art; quick to ship.

**Tech:** Reuse SpotlightLyrics or BackstageLyrics (or current component); edit only the heading (and optional subline) in that component and in any shared strings.

---

## Recommendation

- For **maximum uniqueness and interaction:** Option A (word cloud) or Option B (flow line).
- For **strong product tie-in:** Option C (setlist strip).
- For **fastest change:** Option D (new copy only).

---

## Next Step

Pick one option (A, B, C, or D) and we can implement it in the "Ready for any song" slot: new component or modify existing, then swap in `page.tsx`. The "Every song, One flow" (WorshipStream) section stays as-is.
