# Measuring STT and Matching Latency

Use this to see where time is spent in the live pipeline. **We use ElevenLabs**; if measurements show STT already fast (e.g. 5–20 ms), stick with it. Google streaming is available as an optional alternative to compare.

## Where to look

**Backend logs** (Railway dashboard, or local terminal when running the backend):

1. **STT round-trip**  
   `[STT] ⏱️ latency audio_sent_to_transcript_received=Xms`  
   Time from sending audio to the STT provider until a transcript is received. This is the STT segment.

2. **Matching time**  
   `[WS] ⏱️ findBestMatchAcrossAllSongs took Xms`  
   Should usually be low (e.g. under 20 ms). If this is high, matching is the bottleneck.

3. **Total handler time**  
   `[WS] ⏱️ handleTranscriptionResult … total=Xms`  
   Total time in the handler for one transcript (includes STT callback + matching + any Bible path).

## How to interpret

- If **STT latency is often 200–500 ms** and matching is under ~20 ms, the bottleneck is STT/network. Trying Google streaming (or another provider) may help.
- If **STT is already ~100–150 ms** (or lower) and total is low, STT is not the bottleneck; stick with ElevenLabs.
- **Browser:** In devtools console you may see `[WS] ⏱️ DISPLAY_UPDATE received at <timestamp>` (if that log is enabled). Use it to compare when the backend sent the update vs when the client received it.

## How to read the logs (example)

Real backend lines and what they mean:

| Log line | Meaning |
|----------|--------|
| `[STT] ⏱️ latency audio_sent_to_transcript_received=6ms` | Six milliseconds from sending audio to ElevenLabs until we got this transcript. Very fast. |
| `[STT] 📝 ElevenLabs transcript: "When I in awe" (isFinal=false, ...)` | The text ElevenLabs returned. `isFinal=false` = partial, `isFinal=true` = committed. |
| `[WS] 🎤 Transcription: "When I in awe"` | Same transcript, echoed when we start handling it. |
| `[WS] Rolling buffer updated: "when i in awe..."` | Buffer we use for matching (last ~250 chars). |
| `[WS] 🔍 Current song: "God will make a way"` | Song we’re currently on. |
| `[MATCHER] Line 5: "hold me closely..." → 5.9%` | Similarity of buffer to that line (5.9%). |
| `[MATCHER] ❌ No match (best: 14.4%)` | Best score in current song was 14.4%, below threshold (e.g. 85%). |
| `[MULTI-SONG] Current song confidence 0.0% is low (<60%), checking other songs...` | Current song didn’t match, so we check other setlist songs. |
| `[MULTI-SONG] Song 0 ("How Great Thou Art") Line 0: 61.9%` | That line in song 0 matched the buffer at 61.9%. |
| `[MULTI-SONG] 🎵 SONG SWITCH DETECTED: "How Great Thou Art" @ 61.9%` | We’re suggesting a switch to this song at this confidence. |
| `[WS] 🎵 New song switch suggestion: "How Great Thou Art" @ 61.9% (1/2)` | One of two sustained matches needed before auto-switch. |
| `[WS] 🔁 Song switch suggestion sustained (2/2)` | Second match; we’re about to auto-switch. |
| `[WS] 🎵 AUTO-SWITCHING to song "How Great Thou Art"` | We switched the current song and will send DISPLAY_UPDATE. |
| `[WS] ⏱️ findBestMatchAcrossAllSongs took 1ms` | Matching (current + other songs) took 1 ms. |
| `[WS] ⏱️ handleTranscriptionResult song path total=3ms` | Whole handler for this transcript took 3 ms. |

**Typical good run (ElevenLabs):** STT latency 5–20 ms, findBestMatch 0–2 ms, handleTranscriptionResult total 2–5 ms. If you see that, STT is not the bottleneck; we stick with ElevenLabs.

## Compare providers (optional)

1. Run a live session with **ElevenLabs** (`STT_PROVIDER=elevenlabs`), note typical `audio_sent_to_transcript_received` and `handleTranscriptionResult total` values.
2. Switch to **Google streaming** (`STT_PROVIDER=google`, `GOOGLE_APPLICATION_CREDENTIALS` set, frontend `NEXT_PUBLIC_STT_PROVIDER=google`).
3. Run the same kind of session and compare the same log lines.
4. If Google is not clearly better, stick with ElevenLabs.

## Provider research summary (2026-05-19)

Researched the landscape for live-lyric STT in May 2026. **Decision: stay on ElevenLabs `scribe_v2_realtime`.**

| Provider | Model | TTFB Partial | $/hr | Sung-vocal tuned? |
|---|---|---|---|---|
| **ElevenLabs (current)** | scribe_v2_realtime | ~150 ms | $0.39–0.48 | Robust to background music; closest to sung-tuned |
| Deepgram | Nova-3 / Flux | <300 ms | $0.46 | No |
| AssemblyAI | Universal-3 Pro | ~150 ms | $0.45 | No |
| Soniox | STT RT v3 | <200 ms | $0.30 | No |
| Gladia | Solaria-1 | ~103 ms | ~$0.50 | No |
| OpenAI | gpt-4o-realtime | 300–500 ms | ~$6 | No |
| AudioShake | Lyric Transcription | **batch only** | custom | **~90% sung accuracy** (not realtime) |

**Reality check:** No mainstream realtime STT is tuned for sung vocals. Academic ceiling is ~20% WER on sung lyrics vs 3–6% on speech. Switching providers buys 0–50 ms at best with real accuracy regression risk on sustained vowels and melisma.

## Tuning recipe (do this before considering a switch)

These env vars are already wired in `backend/src/services/sttService.ts` and read at WS handshake — no code changes needed. Set on Railway backend service and restart.

```env
ELEVENLABS_VAD_SILENCE_THRESHOLD_SECS=0.3   # default 1.5 — saves >1s on commit latency
ELEVENLABS_MIN_SPEECH_DURATION_MS=50        # default 100 — catches short syllables
ELEVENLABS_MIN_SILENCE_DURATION_MS=50       # default 100 — faster segment cut
ELEVENLABS_VAD_THRESHOLD=0.4                # 0.3 for quiet singing
```

Bigger latency/accuracy wins beyond env tuning (require code changes — not yet implemented):
- Match against `partial_transcript` rather than waiting for `committed_transcript`. Commits are for archive/display; partials stream every few hundred ms.
- Send audio in 20–40 ms chunks instead of larger buffers — smaller chunks = faster partials.
- Pass the current setlist's distinctive lyrics as `keyterms` at session start to bias recognition (max 50 terms / 20 chars each; +20% cost).
- Phonetic matching (Metaphone/Soundex) on partials to survive sung-vowel errors.

When to revisit this decision: if measured `audio_sent_to_transcript_received` is consistently >200 ms after VAD tuning, or if a new provider publishes a sung-vocal-tuned realtime model.
