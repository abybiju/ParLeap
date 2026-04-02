# Hum Pitch Extraction Service (CREPE)

Python service that extracts pitch contours from audio using TorchCrepe. Used by ParLeap for hum-to-search: extracts pitch from both user hums and reference tracks; matching is done via DTW in the Node.js backend.

## Setup (Local)

```bash
cd hum-embedding-service
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

## Run

```bash
python main.py
# or: uvicorn main:app --host 0.0.0.0 --port 8000
```

- Health: `GET http://localhost:8000/health`
- Extract pitch: `POST http://localhost:8000/extract-pitch` with form field `audio` = WAV file
- Legacy compat: `POST http://localhost:8000/embed` (same as extract-pitch)

Response:
```json
{
  "pitch_contour": [440.0, 441.2, ...],
  "interval_sequence": [0.05, -0.12, ...],
  "num_frames": 1501,
  "num_voiced": 270,
  "num_intervals": 269,
  "duration_seconds": 15.0
}
```

Query param `voiced_threshold`: 0.3 (default, for hums) or 0 (for polyphonic YouTube audio).

## Deployment (Railway)

- **Root directory**: `hum-embedding-service/`
- **Start command**: `uvicorn main:app --host 0.0.0.0 --port $PORT`
- **No env vars required** — model downloads on first startup
- Set the service URL as `EMBEDDING_SERVICE_URL` on the backend service
