# Smart Bible Listen v2 — Reliable Trigger + Fuzzy Reference Parser (Build Plan)

**Status:** 📐 Planned (ready to implement)
**Date:** 2026-06-17
**Supersedes:** `SMART_BIBLE_LISTEN.md` (stale — said "not implemented"; it's implemented and *disabled*).
**Owner priority:** Reliability in a noisy sanctuary, not cost. Willing to pay for premium only if it measurably helps. Validated against real sermon audio (The Bridge PA "Acts 9", yt `H0x_vlCthpo`, `VYnIevxB_8E`).

---

## 1. Goal & guiding principle

In a ~1‑hour sermon there are only **2–3 moments** where the preacher names a book / references a verse. We want STT to **trigger only at those moments** and stay idle otherwise, and to **reliably fire every time even with worship music / congregation noise.**

**Guiding principle — _trigger liberally, project conservatively_:**

| Stage | Visible to congregation? | Tune for | Threshold |
|---|---|---|---|
| **TRIGGER** (open the 30s listen window) | ❌ No | **Recall** — never miss a real reference | liberal |
| **PROJECT** (put a verse on the big screen) | ✅ Yes | **Precision** — never show a wrong/garbage verse | strict |

Opening the window is free and invisible, so we open it easily. A verse only reaches the screen when book + in‑range chapter:verse **validate**. This is how we get reliability *without* embarrassing false displays (the thing you flagged).

---

## 2. Architecture (reuses the existing pipeline)

```
                         ┌─────────────────────── OPERATOR BROWSER ───────────────────────┐
  Soundboard ── USB ──▶  │  getUserMedia(deviceId, DSP OFF) ──▶ PCM 16k mono (existing)    │
  (pastor mic)           │       │                                                          │
                         │       ├── (existing) WebSocket stream ───────────────────────────┼──▶ BACKEND
                         │       └── push-to-talk "capture verse now" button (manual force)  │
                         └─────────────────────────────────────────────────────────────────┘
                                                                                              │
   BACKEND (Node/Railway)                                                                     ▼
   ┌──────────────────────────────────────────────────────────────────────────────────────────┐
   │  handleAudioData (existing)                                                                 │
   │     ├── Stage 1 ALWAYS‑ON DETECTOR (NEW): fork PCM → self‑hosted Whisper `small`            │
   │     │        → fuzzy parser TRIGGER gate → if hit: open STT window (server‑side)            │
   │     ├── Stage 2 CAPTURE (existing): ElevenLabs Scribe 30s burst during open window          │
   │     │        → fuzzy parser PROJECT gate (book + in‑range chapter:verse, cross‑source)      │
   │     └── Stage 3 FOLLOW: number‑only utterances scoped to active book/chapter                │
   └──────────────────────────────────────────────────────────────────────────────────────────┘
```

- **Detector runs on the BACKEND, not the browser.** Browser Web Speech API (current `useBibleWakeWord`) sleeps on tab blur, dies over long sessions, isn't noise‑robust — it's the weak link and gets retired.
- **Engine = free self‑hosted Whisper `small`.** Validated: `base` already nailed "turn to Acts chapter 9"; `small` fixed the one book‑name miss ("Galician"→"Galatians"). Upgrade lever = bigger free model (more CPU, $0), never paid STT for the always‑on path.
- **ElevenLabs stays** only for the 2–3 accurate bursts (pennies). **No Picovoice** ($6k/yr, free tier ends 2026‑06‑30, number slots cap 0–99 can't do Psalm 119/150).
- **Lyrics/song mode is untouched** — it needs continuous STT and is exempt from the gate (already true via `shouldUseSmartListenGate` requiring `bibleMode`).

---

## 3. Implementation phases (de‑risked order — each ships value)

### Phase B (do FIRST) — Fuzzy reference parser  ⟵ highest value, lowest risk, no infra
Pure logic, fully testable offline against the real sermon cases. **Also fixes the 3 confirmed bugs that hurt the _current_ Bible‑follow path** (`findBibleReference` is called at `handler.ts:1067` and `:1538` regardless of Smart Listen), so it improves things immediately even before the detector exists.

**New module:** `backend/src/services/bibleReferenceParser.ts` (keeps `findBibleReference(input): BibleReference | null` as a thin wrapper so `handler.ts` is unchanged; add `parseForTrigger()` / `parseForProject()` for the two‑threshold API).

**Confirmed bugs to fix:**
1. `bibleService.ts:136-140` — bare book name forces `chapter=1, verse=1` → "John" (a person) projects John 1:1. **Remove**; bare book with no adjacent in‑range number = no match.
2. `bibleService.ts:67-76` — global homophone replace (`won→1, too→2, for/four→4, ate/eight→8…`) corrupts prose. **Remove**; do number‑word conversion *scoped to the post‑book chapter:verse zone only*.
3. `bibleService.ts:169` — deprecated `string-similarity` Dice, no phonetic gate. **Replace** with the phonetic + edit‑distance cascade below.

**Libraries (backend is CommonJS, `esModuleInterop: true`, target ES2022):**
- `bible-passage-reference-parser` (bcv_parser) v3.2.0, MIT — **final structured parse + authoritative in‑range validation.** Import only the English CJS build: `require('bible-passage-reference-parser/cjs/en_bcv_parser.js')` (~150KB). Config: `passage_existence_strategy:'bcv'` (rejects out‑of‑range), `book_alone_strategy:'ignore'` (kills bare‑book false fires), `parse_with_context()` (follow‑mode). Ships the versification tables (Psalms=150, Psalm 119=176) so **we never hand‑maintain verse counts.**
- `double-metaphone` (wooorm) v2.0.1, MIT — phonetic gate. ESM‑first → load via cached dynamic `import()` at startup, or vendor the ~200‑line encoder. **Decision needed (see §7).**
- `fastest-levenshtein` v1.0.16, MIT, CJS — Levenshtein primitive (on DM codes and surface forms); add a ~40‑line Damerau wrapper.
- **Vendor** a ~30‑line Jaro‑Winkler and a ~60‑line number‑word table (safer than `words-to-numbers`, which joins "three sixteen"→316; we need 3:16).
- **Do NOT** use `natural` (pulls mongoose/pg/redis) or `talisman` (stale). Keep `string-similarity` out of the new path.

**Reuse:** `backend/src/data/bibleBooks.ts` (68 entries, already carries STT mishears like `sams`/`salms`).

**Pipeline (raw STT text + n‑best → validated reference):**
1. **Clean** — lowercase, normalize unicode dashes/quotes, keep `: . , -` and digits/letters. (No global homophone replace.)
2. **Spoken‑number normalize (scoped)** — `first/second/third` + numbered‑book stem → `1/2/3 stem`; in the post‑book number zone, word→digit per token (1st number = chapter, 2nd = verse), so "three sixteen" → "3 16" (not 316).
3. **Separator coercion** — `John 10 16` / `10.16` / `10, 16` → `John 10:16`; `61 to 64` → `61-64`; keep `chapter N verse M`.
4. **Book candidate extraction** — optional leading numeral/ordinal + 1–2 name words (drop "of" for "Song of Solomon"); look around detected numbers and scripture‑cue sites.
5. **Book match (4‑stage cascade, argmin over all 66 — never threshold‑accept):**
   a. exact alias → 1.0;
   b. phonetic‑code map hit;
   c. fuzzy `combined = 0.6·jaroWinkler + 0.4·(1 − damerau/maxLen)`, then `+0.12` if DM codes share a code (min over {primary,secondary}² cross‑product) else `×0.85`; length‑tiered max‑edit cap (≤4 chars: 1 edit, 5–7: 2, 8+: 3);
   d. **hard ordinal agreement** — spoken "2" must not resolve to "1 Corinthians" (phonetic codes are identical for 1/2 Samuel etc., so the numeral is the disambiguator).
6. **TRIGGER decision (liberal):** open window if `combined≥0.72` OR (DM‑match AND `jw≥0.80`) OR (`best≥0.65` AND a chapter/verse number co‑detected) OR (scripture cue immediately followed by book + number). Run across n‑best, keep best.
7. **PROJECT normalize + parse:** assemble `CanonicalBook C:V[-V2]` → `bcv_parser` (`bcv` existence, `book_alone:'ignore'`, `zero_chapter/zero_verse:'error'`) → read `{b,c,v}` from `parsed_entities()`.
8. **PROJECT decision (strict):** display only if ALL hold — (i) bcv returned an in‑range entity; (ii) `combined≥0.90` AND DM codes agree; (iii) short common‑word books {Job, Acts, Mark, John, Jude, Ruth, Amos, Joel, Ezra, Luke} require an adjacent in‑range number; (iv) **≥2 sources agree on book+chapter** (the always‑on Whisper transcript and the ElevenLabs burst are the two sources; n‑best if available). Any book disagreement → don't project.

**False‑positive controls:** bcv `book_alone:'ignore'` + `bcv` range rejection; short‑book number guard; DM PROJECT gate (blocks "Galician"→"Galatians" reaching screen on a lone source); cross‑source agreement; scripture‑cue binding only when followed by book+number ("we turn to the Lord" / "the book of life" → no match); follow‑mode timeout.

**Test suite** (`bibleReferenceParser.test.ts`, vitest) — encode the real measured cases:

| Input (STT) | Expected | Stage |
|---|---|---|
| `Galatians 2:20` / `2.20` | Galatians 2:20 | PROJECT |
| `Galician 2.20` | Galatians (fuzzy) | TRIGGER yes; PROJECT only with corroborating source |
| `John 10 16` / `John 10.16` | John 10:16 | PROJECT |
| `Acts chapter 9` / `Acts chapter nine` | Acts 9 | PROJECT |
| `Mark 14, 61 to 64` | Mark 14:61‑64 | PROJECT |
| `first Corinthians thirteen` | 1 Corinthians 13 | PROJECT |
| `John three sixteen` | John 3:16 | PROJECT |
| `salms 23` / `Ecclesiates 3` / `Revelations 22` | Psalms 23 / Ecclesiastes 3 / Revelation 22 | PROJECT |
| `we turn to the Lord` / `the book of life` / `John was a good man` | — | NO match |
| `Galatians 7:99` / `Psalm 119:177` / `John 25:99` / `Psalm 151` | — | rejected (out of range) |
| `second Samuel seven` | 2 Samuel 7 | PROJECT (ordinal disambig) |
| follow: project John 3, then `verse 16` | John 3:16 | PROJECT (context) |

### Phase A — Soundboard input source (independent; improves everything)
`frontend/lib/hooks/useAudioCapture.ts`:
- Add an **input‑device picker**: `enumerateDevices()` + persisted selection; call `getUserMedia({ audio: { deviceId: { exact } } })` (the two call sites are **lines 162 and 507**).
- **Branch the DSP constraints** (currently hardcoded `true` at **166–168** and **511–513**): for a soundboard/interface input set `echoCancellation/noiseSuppression/autoGainControl: false` (raw, dry voice); keep them `true` only on the room‑mic fallback.
- **Hard‑fail loudly** if the chosen device disappears (don't silently fall back to the laptop mic).
- Document the macOS routing recipe (USB interface, or BlackHole + Aggregate Device) for operators.

### Phase C — Backend always‑on Whisper detector (the bigger lift; depends on B)
**New service:** `backend/src/services/bibleTriggerService.ts` — runs Whisper `small` continuously over the session's PCM and emits reference‑detection events.
- **Sidecar approach** (recommended): a small `faster-whisper`/`whisper.cpp` process (Python or native) the Node backend feeds via stdin/IPC or a localhost socket; streams ~2–4s chunks with a short overlap; gate with VAD (Silero) so music‑only stretches are skipped. Maintain a ~400ms pre‑roll ring buffer.
- **Wire into** `handler.ts handleAudioData` (~`:2056`): when `shouldUseSmartListenGate` is active and the window is **closed**, instead of dropping audio (current `return` at the gate ~`:2133`), **fork it to the detector**. On a TRIGGER, open the window server‑side (reuse `handleSttWindowRequest` logic ~`:2291`, `BIBLE_SMART_LISTEN_WINDOW_MS` at `:182`) and let the existing ElevenLabs burst capture run, then PROJECT via Phase B.
- **Cost:** a few $/month Railway CPU; scales with concurrent live sessions (runs only during services).

### Phase D — Push‑to‑talk backstop + retire Web Speech
- `OperatorHUD.tsx`: always‑visible **"Capture verse now"** button → force‑opens the window + pre‑roll + ElevenLabs burst (guaranteed human fallback). Pause the auto‑detector while held to avoid dueling taps.
- Flip the kill line `OperatorHUD.tsx:99` `const effectiveSmartListen = false;` → gate on `bibleMode` (the gate now drives the Whisper detector, not the fragile Web Speech path).
- **Retire** `useBibleWakeWord` (Web Speech API) as the primary path (keep as optional fallback only). Fix or delete the digit‑only `bibleWakeWords.ts` regex (superseded by the backend parser).

### Phase E — Follow‑mode + rollout polish
- After a PROJECT, store `sessionContext={book, chapter, expiresAt}`; route number‑only / "verse N" / "look at verse N" through `bcv.parse_with_context(utterance, "Book Chapter")` while live; clear on new full reference or timeout (~60s / N utterances). Already‑present Bible‑follow semantics in `handler.ts` integrate here.

---

## 4. Config / env vars
```
BIBLE_SMART_LISTEN_ENABLED=true            # server kill switch (existing; rename suggested — see §7)
BIBLE_SMART_LISTEN_WINDOW_MS=30000         # existing
BIBLE_DETECTOR_MODEL=small                 # whisper model: base|small|medium (free; CPU tradeoff)
BIBLE_TRIGGER_THRESHOLD=0.72               # liberal
BIBLE_PROJECT_THRESHOLD=0.90               # strict
BIBLE_FOLLOW_CONTEXT_MS=60000
BIBLE_VERSIFICATION=kjv                    # bcv versification (kjv|nrsv…); see §7
```

## 5. Testing & staged rollout
1. **Offline bench** — run the parser + Whisper over the saved clips in `/tmp/parleap_sermon_test/` and any new recordings; measure miss‑rate (must catch all real refs) and false‑PROJECT‑rate (must be ~0). Tune thresholds. **Mandatory before any live use.**
2. **Shadow mode** — run the detector live but log would‑be projections without showing them; compare against the operator's manual actions for a few services.
3. **Live with backstop** — enable projection with the push‑to‑talk button always available; operator can correct/force. Monitor.
4. **Full** — default on for Bible mode; keep the manual button.

## 6. Sequencing & effort (rough)
- **Phase B (parser):** ~1–2 days. Self‑contained, immediately useful, fixes current bugs. **Start here.**
- **Phase A (input):** ~0.5–1 day. Independent.
- **Phase C (detector):** ~2–4 days (the sidecar + streaming + VAD is the real work).
- **Phase D (button + flip + retire Web Speech):** ~0.5 day.
- **Phase E (follow‑mode):** ~1 day + tuning.

## 7. Open decisions (need the owner)
1. **double‑metaphone load:** cached dynamic `import()` vs vendor the ~200‑line encoder (CJS backend). *Recommend: vendor — zero supply‑chain risk, simplest.*
2. **Versification default:** KJV (recommended; matches most congregation Bibles) vs switch bcv per active version when ESV/KJV toggled (the app already supports both). A few Psalm‑superscription / 3 John / Malachi verse numbers differ.
3. **n‑best availability:** if the Whisper/ElevenLabs integrations don't expose alternatives, the cross‑source PROJECT rule uses the two transcripts (detector + burst); raise single‑source PROJECT bar to ~0.93 and lean on the DM gate + bcv. *Confirm what each STT returns.*
4. **Follow‑mode scope:** time window vs utterance count; whether a bare "three sixteen" may anchor to live context.
5. **Detector hosting:** sidecar process on the existing Railway backend vs a separate small service. *Recommend: sidecar to start.*
6. **Rename** the inverted `BIBLE_SMART_LISTEN_KILL_SWITCH` (`handler.ts:180`, true when env is `'false'`) to avoid an ops mistake.
