# Measuring STT and Matching Latency

Use this to see where time is spent before trying a different STT provider (e.g. Google streaming).

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
- If **STT is already ~100–150 ms** and total is still high, look at the other segments or frontend.
- **Browser:** In devtools console you may see `[WS] ⏱️ DISPLAY_UPDATE received at <timestamp>` (if that log is enabled). Use it to compare when the backend sent the update vs when the client received it.

## Compare providers

1. Run a live session with **ElevenLabs** (`STT_PROVIDER=elevenlabs`), note typical `audio_sent_to_transcript_received` and `handleTranscriptionResult total` values.
2. Switch to **Google streaming** (`STT_PROVIDER=google`, `GOOGLE_APPLICATION_CREDENTIALS` set, frontend `NEXT_PUBLIC_STT_PROVIDER=google`).
3. Run the same kind of session and compare the same log lines.
4. If Google is not clearly better, stick with ElevenLabs.
