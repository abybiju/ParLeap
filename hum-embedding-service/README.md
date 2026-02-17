# Hum Embedding Service (YouTube-style)

Small Python service that turns a WAV file into a single 768-dimensional embedding vector using Wav2Vec2. Used by ParLeap for hum-to-search: same model embeds both the user's hum and reference tracks; matching is done via vector similarity in Supabase (pgvector).

## Setup

On macOS/Linux use `python3` (often no `python` alias):

```bash
cd hum-embedding-service
python3 -m venv venv
source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

If `pip install` fails with an **SSL certificate error** (e.g. `SSLCertVerificationError`), fix your certs or try:
```bash
pip install --trusted-host pypi.org --trusted-host files.pythonhosted.org -r requirements.txt
```

## Run

```bash
uvicorn main:app --host 0.0.0.0 --port 8000
```
(With the venv activated, `uvicorn` is on your PATH.)

- Health: `GET http://localhost:8000/health`
- Embed: `POST http://localhost:8000/embed` with form field `audio` = WAV file

Response: `{ "embedding": [float, ...], "dim": 768 }`

## Deployment

Can be deployed as a separate service (e.g. Railway, Fly.io) or run alongside the Node backend. Set `EMBEDDING_SERVICE_URL` in the Node backend to point here (e.g. `http://localhost:8000` or production URL).
