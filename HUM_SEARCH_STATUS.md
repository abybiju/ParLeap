# Hum-to-Search Feature Status

**Last Updated:** January 29, 2026  
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

## Testing Checklist

- [ ] Verify audio recording works (check browser console)
- [ ] Verify WAV format is correct (check network request)
- [ ] Verify backend receives request (check Railway logs)
- [ ] Verify BasicPitch model loads (check Railway logs)
- [ ] Verify job queue creates jobs (check Railway logs)
- [ ] Verify polling works (check browser console)
- [ ] Verify results display correctly
- [ ] Test with "Amazing Grace" (known song in database)
- [ ] Test with "Way Maker" (known song in database)

## Performance Notes

- **Recording**: 5 seconds max (reduces payload size)
- **Processing**: 30-60 seconds (BasicPitch inference)
- **Polling**: Every 1 second, max 60 attempts
- **Payload**: ~290KB base64 for 5 seconds of audio

## Next Steps

1. Push latest TypeScript fixes
2. Deploy and test end-to-end
3. Monitor Railway logs for processing times
4. Consider performance optimizations if needed
5. Add user feedback for long processing times

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
