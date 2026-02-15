# Background Visuals and Announcement Slides — Roadmap

**Last updated:** February 2026

This doc summarizes how ProPresenter/ProContent handle visuals, ParLeap’s current state, and the roadmap items for background visuals and announcement slides (plus font options). Acceptance criteria and implementation details are deferred to implementation phases.

---

## How ProPresenter / ProContent do it

- **ProPresenter** ([renewedvision.com/propresenter](https://www.renewedvision.com/propresenter)): Multi-screen render engine, up to 8 content layers, video playback within slides, timecode sync, broadcast-quality outputs, stage display, and automations (macros, MIDI/DMX). Bibles (130+ translations), Planning Center sync, ProPresenter Remote.
- **ProContent** ([procontent.renewedvision.com](https://procontent.renewedvision.com/)): Curated library (50,000+ assets): motion graphics, cinematic clips, countdowns, sermon series templates, stock video. Direct integration inside ProPresenter so operators pick backgrounds without leaving the app. Lyrics/text sit on top of video or motion backgrounds via multiple layers.

ParLeap is not building a ProContent clone; the roadmap adds **optional** background layer capability and **announcement** content type, with asset sources to be chosen later (operator uploads, URLs, optional stock/library, or AI-generated).

---

## ParLeap current state

- **Projector/audience view** (`frontend/components/projector/ProjectorDisplay.tsx`): Static CSS gradient background (`from-slate-950 via-slate-900 to-slate-950`). Lyrics and title only; no video, image, or motion layers.
- **Setlist types** (`backend` eventService, event_items): `SONG`, `BIBLE`, `MEDIA` (single `media_url` / `media_title`). No announcement or custom-slide type with multiple assets or AI-generated content.
- **Fonts** (`frontend/lib/projectorFonts.ts`): Eight Google Fonts via `next/font/google`; stored per event as `projector_font`, sent via WebSocket.

---

## Roadmap items (summary)

### 1. Background visuals for projector view

- **Goal:** Optional background layer behind lyric/verse content: static image, looped video, or subtle motion (e.g. gradients, low-motion loops).
- **Options to consider:** Operator-selectable background per event or per slide (image/URL); optional integration with media library or stock; performance constraint (no frame drops on projector output).
- **No commitment** to a specific asset source.

### 2. Announcement slides and Ideogram AI

- **Announcement slide type:** New setlist item type (e.g. `ANNOUNCEMENT` or extended `MEDIA`) with one or more slide assets (images, graphics, video). Shown in sequence; advance manually or by setlist position. Schema: multiple assets per item, optional title/caption, order.
- **Ideogram AI (optional):** Operator enters a text prompt (e.g. “Welcome to our Easter service”) → backend calls [Ideogram API](https://developer.ideogram.ai/) (Ideogram 3.0, optional transparent background) → generated image stored (e.g. Supabase Storage) → added as slide/asset in the announcement item. API is pay-as-you-go; implementation needs prompt UI, backend proxy for API key safety, and storage of image URL.

### 3. Expand projector font options

- **Goal:** More font choices for projector display, e.g. via Google Fonts API (load more families on demand, font picker in operator/event settings) or other providers (Adobe Fonts, Fontshare, self-hosted). Keep design flexible (font family ID + optional provider or URL).

---

## References

- ProPresenter: https://www.renewedvision.com/propresenter  
- ProContent: https://procontent.renewedvision.com/  
- Ideogram API: https://developer.ideogram.ai/
