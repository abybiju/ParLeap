# Hum-to-Search Feature Status

**Last Updated:** February 16, 2026  
**Status:** ⚠️ Implementation Complete + Deployed, End-to-End Testing Pending

## Overview

Hum-to-Search allows users to find songs by humming the melody. The system supports two paths:

- **YouTube-style (optional):** When `EMBEDDING_SERVICE_URL` is set, the backend POSTs the user’s WAV to a Python embedding service (e.g. Wav2Vec2), gets a 768D vector, and searches via `match_songs_by_embedding()`. Reference tracks are embedded at ingest time and stored in `song_fingerprints.embedding`.
- **BasicPitch (default):** When the embedding service is not configured, the backend uses BasicPitch to extract a 128D melody vector and searches via `match_songs()` (column `melody_vector`).

Same API and frontend; only the backend search path changes.

## Architecture

```
User Hum → Frontend (WAV) → Backend → [Embedding service OR BasicPitch] → Vector → Supabase (pgvector) → Results
```

### Components

1. **Frontend Recording** (`ListeningOverlay.tsx`)
   - Records audio using AudioContext (22050 Hz, mono)
   - Converts to WAV format using `audioUtils.ts`
   - Sends base64-encoded WAV to backend

2. **Backend Processing**
   - **If `EMBEDDING_SERVICE_URL` is set (YouTube-style):** `humSearchService.ts` POSTs WAV to the Python service, receives 768D embedding, then calls Supabase `match_songs_by_embedding(query_embedding, threshold, limit)`.
   - **Otherwise:** `melodyService.ts` (BasicPitch) extracts 128D melody vector; `humSearchService.ts` calls `match_songs(query_vector, threshold, limit)`.

3. **Database**
   - `song_fingerprints.melody_vector` (128D) — BasicPitch path.
   - `song_fingerprints.embedding` (768D) — YouTube-style path; migration `017_embedding_column_and_match_songs_by_embedding.sql` adds column and `match_songs_by_embedding()`.

4. **Async Job Queue** (`jobQueue.ts`)
   - Prevents timeout issues (BasicPitch or embedding call can be slow)
   - Returns job ID immediately; frontend polls for results

## Current Implementation

### ✅ Completed

- [x] Database migration (`003_add_melody_vectors.sql`)
- [x] Melody extraction service (BasicPitch)
- [x] Ingestion script (processed 2 songs)
- [x] Backend search API endpoint
- [x] Frontend UI with real audio recording
- [x] WAV format conversion
- [x] Async job queue pattern
- [x] Error handling and logging

### ⚠️ Known Issues

1. **BasicPitch Performance**
   - Takes 30-60 seconds for 5 seconds of audio
   - Pure JS TensorFlow.js (no GPU acceleration)
   - Async processing prevents timeouts but doesn't solve speed

2. **Testing Needed**
   - End-to-end flow not yet verified in production
   - Need to check Railway logs for processing times
   - Verify model loads correctly on Railway

3. **Job Queue Limitations**
   - In-memory storage (jobs lost on restart)
   - No persistence across deployments
   - For production, consider Redis or database-backed queue

## Files

### Backend
- `backend/src/services/melodyService.ts` - Melody extraction
- `backend/src/services/humSearchService.ts` - Search logic
- `backend/src/services/jobQueue.ts` - Async job queue
- `backend/src/index.ts` - API endpoints
- `backend/scripts/ingest-audio.ts` - Ingestion script

### Frontend
- `frontend/components/search/HumButton.tsx` - Trigger button
- `frontend/components/search/ListeningOverlay.tsx` - Recording UI
- `frontend/lib/audioUtils.ts` - WAV encoder

### Database
- `supabase/migrations/003_add_melody_vectors.sql` - Melody vectors (128D)
- `supabase/migrations/016_match_songs_return_lyrics.sql` - `match_songs` returns lyrics
- `supabase/migrations/017_embedding_column_and_match_songs_by_embedding.sql` - `embedding` column (768D) and `match_songs_by_embedding()` for YouTube-style search

## Environment Variables

### Frontend (Vercel)
```
NEXT_PUBLIC_BACKEND_URL=https://parleapbackend-production.up.railway.app
```

### Backend (Railway)
```
PORT=8080 (Railway default)
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
CORS_ORIGIN=https://www.parleap.com
# Optional: YouTube-style hum search (768D embeddings)
EMBEDDING_SERVICE_URL=https://your-embedding-service.up.railway.app
```
When `EMBEDDING_SERVICE_URL` is set, hum search uses the embedding service and `match_songs_by_embedding`; otherwise BasicPitch + `match_songs` is used.

## API Endpoints

### POST /api/hum-search
Creates async job, returns immediately.

**Request:**
```json
{
  "audio": "base64-encoded-wav",
  "limit": 5,
  "threshold": 0.4
}
```

**Response:**
```json
{
  "success": true,
  "jobId": "job_1234567890_abc123",
  "status": "processing",
  "message": "Processing audio..."
}
```

### GET /api/hum-search/:jobId
Poll for job status.

**Response (processing):**
```json
{
  "success": true,
  "status": "processing",
  "message": "Still processing..."
}
```

**Response (completed):**
```json
{
  "success": true,
  "status": "completed",
  "results": [
    {
      "songId": "uuid",
      "title": "Song Title",
      "artist": "Artist Name",
      "similarity": 0.85,
      "lyrics": "..."
    }
  ],
  "count": 1
}
```

## Ensure Hum-to-Search has data

Hum search only returns matches if the `song_fingerprints` table has rows with melody vectors.

**Existing data (from January 29, 2026):** Two fingerprints were already ingested and are in `song_fingerprints`: **Amazing Grace** and **Way Maker** (Leeland). If you see 2 records in the Supabase Table Editor for `song_fingerprints`, you already have data—no need to re-run ingest unless you want to add more songs or refresh vectors.

### Verify row count (fix for "closest query returned empty")

If the backend logs say **"No fingerprints in database (closest query returned empty)"**, the **same** Supabase project that Railway uses has **no rows** (or only rows with null `melody_vector`). Check in the project you use for production (e.g. ParLeap project `ypbqqwevnxqnooplvdyn`):

In Supabase SQL Editor run:

```sql
SELECT COUNT(*) AS total,
       COUNT(melody_vector) AS with_vector
FROM song_fingerprints;
```

- If **total = 0**: the table is empty. Run **Option A** below with `backend/.env` set to this project’s `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` (same as in Railway), then re-test hum search.
- If **total > 0** but **with_vector = 0**: all rows have null `melody_vector`; re-run ingest to refresh.
- If **with_vector > 0**: data exists; if hum still doesn’t match, check Railway env points to this project and consider lowering the threshold or the YouTube-style approach (see research section).

### Option A: Ingest from WAV files (recommended for testing)

1. **Create the input folder**
   ```bash
   mkdir -p backend/songs_input
   ```

2. **Add WAV files**  
   Put one or more `.wav` files in `backend/songs_input/`. The script infers **title** and **artist** from the filename:
   - `Amazing-Grace-Traditional.wav` → title "Amazing Grace", artist "Traditional"
   - `Way-Maker-Sinach.wav` → title "Way Maker", artist "Sinach"  
   Use hyphens or underscores; the last segment is treated as artist, the rest as title.

3. **Configure backend env**  
   In `backend/.env` set:
   ```env
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   ```

4. **Optional: YouTube-style embeddings**  
   If you run the Python embedding service (`hum-embedding-service/`), set in `backend/.env`:
   ```env
   EMBEDDING_SERVICE_URL=http://localhost:8000
   ```
   Then run ingest: each WAV gets both a BasicPitch melody vector and a 768D embedding (from the Python service). Hum search will use the embedding path when `EMBEDDING_SERVICE_URL` is set.

5. **Run the ingest script**
   ```bash
   cd backend
   npm run ingest
   ```
   Each WAV is processed by BasicPitch (about **30–60 seconds per file**). If `EMBEDDING_SERVICE_URL` is set, each file is also sent to the embedding service. Fingerprints are written to `song_fingerprints` (with `song_id` NULL unless you extend the script to link to `songs`). Search still returns these rows; lyrics will be empty until you link them to songs.

### Option B: Link existing songs (for production)

If you already have rows in the `songs` table and want hum results to include lyrics and open the song in the app:

- Either extend the ingest script to look up (or create) a row in `songs` by title/artist and set `song_fingerprints.song_id`, then re-run ingest for those WAVs.
- Or build a separate flow (e.g. “Generate fingerprint” in the song editor) that computes the melody vector for a song’s audio and inserts/updates `song_fingerprints` with that `song_id`.

### Verify data

In Supabase SQL Editor:

```sql
SELECT id, title, artist, song_id, source, created_at
FROM song_fingerprints
LIMIT 10;
```

If this returns rows, hum search can return matches (after you’ve run migration 016 and the backend is using it).

---

## Testing Checklist

- [ ] Apply migration `016_match_songs_return_lyrics.sql` in Supabase (SQL Editor) if using lyrics in results.
- [ ] If using YouTube-style: apply migration `017_embedding_column_and_match_songs_by_embedding.sql` and set `EMBEDDING_SERVICE_URL`; run ingest to fill `embedding` column.
- [ ] Ensure `song_fingerprints` has data (Option A or B above).
- [ ] Verify audio recording works (check browser console on Songs page, click hum button).
- [ ] Verify WAV format is correct (check network request payload to `POST /api/hum-search`).
- [ ] Verify backend receives request (check backend logs for `[HumSearch] Created job`).
- [ ] Verify BasicPitch model loads (check backend logs for `[MelodyService] Using BasicPitch model`; first request may be slow).
- [ ] Verify job queue creates jobs (check logs for `Job ... completed` or `failed`).
- [ ] Verify polling works (check browser console for `[HumSearch] Job ... status:`).
- [ ] Verify results display correctly (match list with similarity %).
- [ ] Test with "Amazing Grace" or "Way Maker" if those songs have been ingested.

## Confidence threshold (avoid false matches)

- **Minimum to show results**: 55% (`MIN_CONFIDENCE_TO_SHOW = 0.55`). The frontend only shows the result list when the best match has similarity ≥ 55%.
- **Request threshold**: Batch hum-search and live hum both use 0.55 so silence or random humming does not return the catalog. Lower thresholds (e.g. 35–40%) caused "no hum" or "random hum" to still show the two ingested songs.
- **UX**: If the best match is below 55%, the user sees "No confident match. Try humming the main tune of a song clearly for 5–10 seconds."

## Performance Notes

- **Recording**: 10 seconds max (user can click "Stop & Search" earlier). Auto-stops and analyzes when time is up.
- **Processing**: 30-60 seconds (BasicPitch inference)
- **Polling**: Every 1 second, max 60 attempts
- **Payload**: ~290KB base64 per ~5s of audio (10s ≈ 580KB, well under 10MB limit)

## Recent Improvements (February 16, 2026)

- **Live hum (YouTube-style)**: When `EMBEDDING_SERVICE_URL` is set, the overlay offers "Match as you hum": user clicks Start, hums, and the app streams 2s chunks to the backend; backend keeps a 5s rolling window, calls the embedding service, and runs `match_songs_by_embedding`. When similarity crosses the threshold, the match is shown immediately ("keep going until we find it"). Endpoints: `GET /api/hum-search/live/available`, `POST /api/hum-search/live/start`, `POST /api/hum-search/live/chunk`, `POST /api/hum-search/live/stop`.
- **YouTube-style path**: Optional Python embedding service (`hum-embedding-service/`): POST WAV → 768D vector; backend uses `match_songs_by_embedding` when `EMBEDDING_SERVICE_URL` is set. Migration 017 adds `embedding` column and RPC. Ingest script can call the embedding service to populate `embedding` in addition to `melody_vector`.
- **Audio trimming (EPIPE fix)**: Embedding service trims audio to **30 seconds max** before processing. Full-length tracks (17–36 min) caused Railway OOM/EPIPE. 30s at 16kHz = 480K samples — more than enough for a representative embedding.
- **Retry logic**: Ingest script retries embedding calls up to 3 times with 5s/10s/15s backoff. Catches transient failures when Railway container restarts.
- **Lazy Supabase init**: `supabase.ts` now reads `process.env` on first access (not module load). Fixes false "Supabase not configured" warning in scripts that call `dotenv.config()` after imports. All 8 backend consumer files updated to use `getSupabaseClient()` / `isSupabaseConfigured()`.
- **Ingestion verified**: Both Way Maker (96MB) and Amazing Grace (45MB) successfully processed with 128D melody + 768D embedding vectors in Supabase.
- **Processing UX**: ListeningOverlay now shows "This may take 30–60 seconds" and a live elapsed-time counter during analysis so users know to wait.
- **API**: `match_songs` RPC extended via migration `016_match_songs_return_lyrics.sql` to return `lyrics` (JOIN songs). Backend tolerates missing lyrics for backward compatibility.
- **Types**: Removed `any` in ListeningOverlay error handling; strict typing for error response.

## Deployment

### Embedding Service (Railway)
- **Service**: Separate Railway service in same project, root directory `hum-embedding-service/`
- **Start command**: `uvicorn main:app --host 0.0.0.0 --port $PORT`
- **URL**: Set as `EMBEDDING_SERVICE_URL` on both Railway backend and local `backend/.env`
- **No env vars required** (model downloads automatically on first startup)
- Model: `facebook/wav2vec2-base` (Wav2Vec2, 768D output)

### Backend Environment
```env
EMBEDDING_SERVICE_URL=https://your-embedding-service.up.railway.app
```
When set: hum search uses YouTube-style 768D path. When absent: falls back to BasicPitch 128D.

## Next Steps

1. Test end-to-end hum search (both batch and live mode) on production.
2. Run migration 017 in Supabase SQL Editor if not applied.
3. Monitor Railway logs for embedding service latency and memory usage.
4. Consider performance optimizations if needed (e.g. Redis-backed job queue for persistence).
5. Add more songs to `song_fingerprints` via ingest to improve match quality.

## Backup Plan: Fastify Server Approach

**If async processing doesn't work, consider implementing:**

### Alternative Architecture
- Use Fastify instead of Express
- Handle file uploads with `@fastify/multipart`
- Simpler request/response pattern
- Might handle large payloads better

**Implementation:**
1. Install: `fastify @fastify/multipart @fastify/cors`
2. Create `backend/src/server.ts` with Fastify
3. Route: `POST /search/hum` accepts file upload
4. Process and return results directly (no async queue)
5. Update frontend to use FormData instead of JSON

**Pros:**
- Simpler architecture
- Better file upload handling
- Faster for small requests

**Cons:**
- Still doesn't solve BasicPitch slowness
- Would need timeout handling
- Less scalable than async queue

**When to Use:**
- If async queue has issues
- If file upload handling is problematic
- If we want simpler architecture
