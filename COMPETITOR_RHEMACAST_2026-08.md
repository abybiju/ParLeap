# Competitor Analysis: RhemaCast vs ParLeap Smart Bible Listen (2026-08-20)

## RhemaCast (rhemacast.io)
- Browser-only SaaS, UK. Free / Pro £15/mo / Church £25/mo (Stripe).
- Detection: direct reference regex → fuzzy phrase match over 31k-verse offline index → "AI semantic" paraphrase layer (5/session on Free, unlimited Pro).
- Features: auto-advance ("verse 7"/"next verse"), self-correction ("I mean…"), cross-reference suggestions, lyric suppression, custom vocabulary, sermon-notes → queue, manual override (arrows, 6 s soft hold, pin/hold), session log w/ confidence, live preview, pause/refresh/resume.
- Output: OBS/vMix transparent browser-source overlay, 6 styles. NO projector output, NO lyrics.
- Translations: KJV, WEB, ASV only (public domain, IndexedDB). No NIV/ESV.
- "Sub-10 ms" = operator→overlay path, not speech→screen.
- Positioning: AI add-on alongside ProPresenter/EasyWorship/Proclaim.

## Other entrants
- Rhema (github.com/openbezal/rhema, openrhema.com): open source Tauri desktop, Whisper local or Deepgram, Aho-Corasick direct + Qwen3-0.6B ONNX embeddings (HNSW), 10 translations (copyrighted via BibleGateway scraper — legal risk), 340k cross-refs, NDI out, OSC/HTTP remote. recall@1 0.836 on 152 queries w/o embeddings.
- Pewbeam, Loghema (ex-LogosAI), SmartVerses, EasyVerse (OSS), QuickVerse, WayPresenter (offline), VerseCAST.
- Conclusion: verse detection is commoditized and racing to free.

## ParLeap today (see agent inventory in session)
- Strengths: wake-word + cost-gated STT (unique), song↔bible voice switching (unique), strong reference parser, content-scored auto-follow, ESV via API, projector output, lyrics.
- Gaps: no operator override/hold/confidence UI, no verse history, no notes→queue, paraphrase only inside follow (OpenAI embeddings), no self-correction, no OBS overlay, no custom vocab, cross-chapter jump unreliable, English only.

## Plan to beat them (value/effort order)
1. ✅ SHIPPED 2026-08-21 — Bible-mode operator controls: confidence + candidates, arrow prev/next, hold pin, undo. See `BIBLE_OPERATOR_CONTROLS.md`.
2. Verse history / session log table + panel (doubles as eval dataset).
3. Sermon-notes → BIBLE setlist queue via bible-passage-reference-parser; follow logic prefers queued refs (fixes cross-chapter jumps).
4. Paraphrase as first-class trigger with local embedding model (Qwen3-0.6B ONNX or similar); auto-project at high threshold, suggest below.
5. Self-correction phrase handling in parser.
6. /overlay/[id] transparent browser-source route (Bible + lyrics) for OBS/vMix.
7. Custom vocabulary → ElevenLabs keyterms + alias table.
Skip: latency marketing, offline mode, analytics/content studio.

## Strategic framing
Moat remains live lyric-following + one hands-free service (songs → sermon → songs). Bundle verse detection under the lyrics plan; do not price it standalone. Keep licensed-API approach for ESV/NIV; never scrape.

Sources: rhemacast.io (/, /features, /pricing), github.com/openbezal/rhema, pewbeam.com, loghema.com, smartverses.app, theeasyverse.com, quickverse.co.uk, waypresenter.com, versecast.app
