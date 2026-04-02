# Hum-to-Search Feature Status

**Last Updated:** April 2, 2026  
**Status:** v2 — CREPE + DTW pipeline operational, 41 songs fingerprinted

## Overview

Hum-to-Search allows users to find songs by humming the melody. The v2 system uses:

- **TorchCrepe** (tiny model) for pitch extraction — <1 second on CPU
- **Dynamic Time Warping (DTW)** for melody matching — handles tempo/key differences naturally
- **Interval sequences** (semitone deltas) for key-invariant matching
- **Subsequence DTW** for matching a hummed chorus against a full song reference

## Architecture

```
User Hum (WAV) → CREPE service (pitch contour) → DTW match against catalog → Results
```

### Components

1. **CREPE Pitch Extraction Service** (`hum-embedding-service/main.py`)
   - FastAPI service using TorchCrepe (PyTorch CREPE reimplementation)
   - Model: `tiny` — runs at ~10x realtime on CPU
   - Returns: pitch contour (F0 at 10ms), interval sequence (semitone deltas), confidence
   - `voiced_threshold` param: 0.3 for hums (monophonic), 0 for YouTube audio (polyphonic)
   - Skips leading silence in reference tracks

2. **DTW Matching Engine** (`backend/src/services/dtwService.ts`)
   - Pure TypeScript, no external dependency
   - Standard DTW + Subsequence DTW (matches chorus within full song)
   - Exponential decay similarity: `exp(-distance / scale)`
   - Brute-force against entire catalog — fast enough for 2000+ songs

3. **Hum Search Service** (`backend/src/services/humSearchService.ts`)
   - In-memory fingerprint cache (5-minute TTL, loaded from Supabase)
   - Primary path: CREPE extraction → DTW matching
   - Legacy fallback: BasicPitch 128D vectors (when EMBEDDING_SERVICE_URL not set)

4. **Auto-Fingerprint Service** (`backend/src/services/autoFingerprintService.ts`)
   - Triggered when any user creates/updates a song
   - Searches YouTube → downloads audio → CREPE extraction → stores globally
   - Fire-and-forget — never blocks song creation
   - Skips if fingerprint already exists (links to song_id instead)

5. **Database** (`song_fingerprints` table)
   - `pitch_contour` (float8[]) — CREPE F0 values at 10ms intervals
   - `interval_sequence` (float8[]) — semitone deltas (key-invariant)
   - `melody_vector` (vector(128)) — legacy BasicPitch path
   - `song_id` — links to user's songs table (nullable for global catalog)

## Catalog

**41 songs fingerprinted** from CCLI Top 100 (as of April 2, 2026):
- Hillsong (7), Phil Wickham (6), Chris Tomlin (5), Elevation Worship (5)
- Bethel Music, Kari Jobe, Matt Redman, Brandon Lake, and more
- Classic hymns through modern worship

The catalog is **self-growing**: every song any user adds triggers auto-fingerprinting via YouTube.

## API Endpoints

### Hum Search
- `POST /api/hum-search` — Submit WAV audio, returns job ID (async)
- `GET /api/hum-search/:jobId` — Poll for results
- `GET /api/hum-search/live/available` — Check if live mode available
- `POST /api/hum-search/live/start` — Start live streaming session
- `POST /api/hum-search/live/chunk` — Send audio chunk for live matching
- `POST /api/hum-search/live/stop` — End live session

### Auto-Fingerprint
- `POST /api/fingerprint` — Trigger fingerprinting for a song `{songId, title, artist}`
- `GET /api/fingerprint/status` — Check if auto-fingerprint is available

## YouTube Ingestion

### Single song
```bash
cd backend
npm run ingest:youtube -- --url "https://youtube.com/watch?v=..." --title "Song Title" --artist "Artist"
```

### Batch from file
```bash
cd backend
npm run ingest:youtube -- --file scripts/worship-songs.json
```

### worship-songs.json format
```json
[
  { "url": "https://youtube.com/watch?v=...", "title": "Song Title", "artist": "Artist" }
]
```

## Environment Variables

### CREPE Service (hum-embedding-service)
- Default port 8000, no env vars needed
- Model downloads automatically on first startup

### Backend (Railway)
```
EMBEDDING_SERVICE_URL=https://your-crepe-service.up.railway.app
```

## Frontend UX

- **Songs in user's library** → clicking match opens the song editor
- **Songs NOT in library** → shows "+ Add" badge → opens editor pre-filled with title/artist
- Recording: 10 seconds max, real-time waveform visualization
- Live mode: streams 2s chunks for real-time matching (when available)

## Performance

| Step | Time |
|------|------|
| CREPE pitch extraction | ~5s (for 15s of audio) |
| DTW matching (41 songs) | <10ms |
| Total end-to-end | ~8-12s |

vs. previous BasicPitch system: 30-60 seconds

## Files

### Backend
- `backend/src/services/dtwService.ts` — DTW matching engine
- `backend/src/services/humSearchService.ts` — Search orchestrator (CREPE + DTW)
- `backend/src/services/humSearchLiveService.ts` — Live streaming search
- `backend/src/services/autoFingerprintService.ts` — Auto-fingerprint on song creation
- `backend/src/services/melodyService.ts` — Legacy BasicPitch extraction
- `backend/src/services/jobQueue.ts` — Async job queue
- `backend/scripts/ingest-youtube.ts` — YouTube batch ingestion
- `backend/scripts/worship-songs.json` — Top 35 CCLI worship songs

### Frontend
- `frontend/components/search/HumButton.tsx` — Trigger button
- `frontend/components/search/ListeningOverlay.tsx` — Recording + results UI
- `frontend/app/songs/actions.ts` — Auto-fingerprint trigger on song CRUD

### CREPE Service
- `hum-embedding-service/main.py` — TorchCrepe pitch extraction
- `hum-embedding-service/requirements.txt` — Python dependencies

### Database
- `supabase/migrations/003_add_melody_vectors.sql` — song_fingerprints table
- `supabase/migrations/025_add_pitch_contour_columns.sql` — CREPE columns
