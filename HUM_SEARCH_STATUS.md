# Hum-to-Search Feature Status

**Last Updated:** February 16, 2026  
**Status:** ⚠️ Implementation Complete, Testing Pending

## Overview

Hum-to-Search allows users to find songs by humming the melody. The system extracts a 128-dimensional melody vector from audio and searches for similar songs using pgvector cosine similarity.

## Architecture

```
User Hum → Frontend (WAV) → Backend (Extract Vector) → Supabase (Search) → Results
```

### Components

1. **Frontend Recording** (`ListeningOverlay.tsx`)
   - Records audio using AudioContext (22050 Hz, mono)
   - Converts to WAV format using `audioUtils.ts`
   - Sends base64-encoded WAV to backend

2. **Backend Processing** (`melodyService.ts`)
   - Uses BasicPitch AI to extract MIDI notes
   - Converts to 128D vector (64 pitch intervals + 64 rhythm ratios)
   - Key-invariant and tempo-invariant

3. **Database Search** (`humSearchService.ts`)
   - Calls Supabase `match_songs()` RPC function
   - Returns top matches with similarity scores

4. **Async Job Queue** (`jobQueue.ts`)
   - Prevents timeout issues (BasicPitch is slow)
   - Returns job ID immediately
   - Frontend polls for results

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
- `supabase/migrations/003_add_melody_vectors.sql` - Schema migration

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
```

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

To add more songs or refresh, use one of the options below.

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

4. **Run the ingest script**
   ```bash
   cd backend
   npm run ingest
   ```
   Each WAV is processed by BasicPitch (about **30–60 seconds per file**). Fingerprints are written to `song_fingerprints` (with `song_id` NULL unless you extend the script to link to `songs`). Search still returns these rows; lyrics will be empty until you link them to songs.

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
- [ ] Ensure `song_fingerprints` has data (Option A or B above).
- [ ] Verify audio recording works (check browser console on Songs page, click hum button).
- [ ] Verify WAV format is correct (check network request payload to `POST /api/hum-search`).
- [ ] Verify backend receives request (check backend logs for `[HumSearch] Created job`).
- [ ] Verify BasicPitch model loads (check backend logs for `[MelodyService] Using BasicPitch model`; first request may be slow).
- [ ] Verify job queue creates jobs (check logs for `Job ... completed` or `failed`).
- [ ] Verify polling works (check browser console for `[HumSearch] Job ... status:`).
- [ ] Verify results display correctly (match list with similarity %).
- [ ] Test with "Amazing Grace" or "Way Maker" if those songs have been ingested.

## Performance Notes

- **Recording**: 10 seconds max (user can click "Stop & Search" earlier). Auto-stops and analyzes when time is up.
- **Processing**: 30-60 seconds (BasicPitch inference)
- **Polling**: Every 1 second, max 60 attempts
- **Payload**: ~290KB base64 per ~5s of audio (10s ≈ 580KB, well under 10MB limit)

## Recent Improvements (February 16, 2026)

- **Processing UX**: ListeningOverlay now shows "This may take 30–60 seconds" and a live elapsed-time counter during analysis so users know to wait.
- **API**: `match_songs` RPC extended via migration `016_match_songs_return_lyrics.sql` to return `lyrics` (JOIN songs). Backend tolerates missing lyrics for backward compatibility.
- **Types**: Removed `any` in ListeningOverlay error handling; strict typing for error response.

## Next Steps

1. Deploy and test end-to-end (run migration 016 in Supabase if not applied).
2. Monitor Railway logs for processing times.
3. Consider performance optimizations if needed (e.g. Redis-backed job queue for persistence).

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
