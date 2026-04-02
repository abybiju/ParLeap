# Scribe v2 Realtime API + VAD for speech/singing vs background noise

## Overview

ParLeap already uses the ElevenLabs Scribe v2 Realtime API. This plan (1) aligns the backend with the official API spec and (2) **makes VAD first-class** so the system reliably distinguishes background noise from actual speech or singing.

---

## Part 1: Current state and API alignment

- **Endpoint:** `wss://api.elevenlabs.io/v1/speech-to-text/realtime` ([sttService.ts](backend/src/services/sttService.ts))
- **Model:** `scribe_v2_realtime`; **commit_strategy** already set from `ELEVENLABS_COMMIT_STRATEGY` (default `vad`).
- **Gaps vs spec:** Add required `commit` field on every `input_audio_chunk`; handle all server error message types (see original plan or API reference).

---

## Part 2: VAD — distinguish background noise from speech/singing

### Why VAD matters

- **Background noise** (room hum, coughs, clapping, rustling) should not trigger commits or dominate the transcript.
- **Actual speech or singing** should be committed and drive lyric/slide sync.

ElevenLabs’ realtime API uses **VAD when `commit_strategy=vad`**: it detects speech start/stop and commits segments when it sees sustained silence after speech. ParLeap already uses this (`commit_strategy=vad`). The next step is to **expose and optionally tune** VAD parameters so you can adapt behavior for noisy rooms or singing (e.g. long held notes, pauses between phrases).

### VAD parameters (ElevenLabs API)

| Parameter | Default | Purpose |
|-----------|---------|---------|
| `vad_threshold` | 0.4 | Sensitivity of speech detection. **Higher** = less sensitive = more rejection of low-level or ambiguous noise. |
| `vad_silence_threshold_secs` | 1.5 | Seconds of silence before the segment is committed. Longer = fewer commits during short pauses (e.g. between phrases or lines). |
| `min_speech_duration_ms` | 100 | Minimum speech duration before treating as real speech. Helps ignore very short noise bursts. |
| `min_silence_duration_ms` | 100 | Minimum silence duration to count as a silence boundary. |

Tuning guidance for “speech/singing vs background noise”:

- **Too many false commits from noise:** Increase `vad_threshold` (e.g. 0.5–0.6) and/or `min_speech_duration_ms` (e.g. 150–200).
- **Speech/singing cut off too early:** Decrease `vad_threshold` slightly or increase `vad_silence_threshold_secs` so longer pauses (e.g. between lines) don’t commit too soon.
- **Singing with long held notes:** Consider a slightly longer `vad_silence_threshold_secs` so a brief breath doesn’t commit mid-phrase.

### Implementation: VAD as a first-class requirement

**File:** [backend/src/services/sttService.ts](backend/src/services/sttService.ts)

1. **Keep `commit_strategy=vad`** (current default) so the API’s VAD is used to decide when to commit.
2. **Add optional env-driven query params** and pass them to the WebSocket URL when set:
   - `ELEVENLABS_VAD_THRESHOLD` (number, e.g. 0.4)
   - `ELEVENLABS_VAD_SILENCE_THRESHOLD_SECS` (number, e.g. 1.5)
   - `ELEVENLABS_MIN_SPEECH_DURATION_MS` (integer, e.g. 100)
   - `ELEVENLABS_MIN_SILENCE_DURATION_MS` (integer, e.g. 100)
3. **Defaults:** If not set, omit the params so the API uses its own defaults (0.4, 1.5, 100, 100). This keeps current behavior while allowing tuning.
4. **Docs:** In `ENV_SETUP_STT.md` (or equivalent), document these four env vars and the “background noise vs speech/singing” tuning guidance above.

Result: VAD remains the mechanism that distinguishes background noise from actual speech/singing; you gain explicit control to adapt it to your environment and use case (speech vs singing, noisy vs quiet room).

---

## Implementation checklist

- [x] Add required `commit` field to every `input_audio_chunk` (e.g. `commit: false` for streaming with VAD).
- [x] Handle all server error message types in `sttService.ts` (auth_error, quota_exceeded, rate_limited, etc.).
- [x] **VAD:** Add optional env vars for `vad_threshold`, `vad_silence_threshold_secs`, `min_speech_duration_ms`, `min_silence_duration_ms` and pass them as query params when set.
- [x] Document VAD env vars and tuning guidance for “background noise vs speech/singing” in project docs.

Optional later: `previous_text`, `include_timestamps`, regional endpoints (see original Scribe v2 plan).
