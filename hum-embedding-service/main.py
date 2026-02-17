"""
Hum Embedding Service (YouTube-style).
Exposes POST /embed: accepts WAV file, returns a single embedding vector.
Uses Wav2Vec2: audio -> last_hidden_state -> mean pool -> 768-dim vector.
Same model used for hum and reference clips for similarity search.
"""
import io
import logging
from typing import List

import torch
import librosa
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from transformers import Wav2Vec2Processor, Wav2Vec2Model

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Hum Embedding Service", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Model: 16kHz expected by Wav2Vec2; output 768-dim
MODEL_ID = "facebook/wav2vec2-base"
TARGET_SR = 16000
EMBEDDING_DIM = 768

processor = None
model = None


def load_model():
    global processor, model
    if model is not None:
        return
    logger.info("Loading Wav2Vec2 model: %s", MODEL_ID)
    processor = Wav2Vec2Processor.from_pretrained(MODEL_ID)
    model = Wav2Vec2Model.from_pretrained(MODEL_ID)
    model.eval()
    logger.info("Model loaded. Embedding dim=%s", EMBEDDING_DIM)


@app.on_event("startup")
def startup():
    load_model()


@app.get("/health")
def health():
    return {"status": "ok", "embedding_dim": EMBEDDING_DIM}


@app.post("/embed")
async def embed(audio: UploadFile = File(...)) -> dict:
    """
    Accept a WAV file (or raw audio). Return a single embedding vector of length 768.
    """
    load_model()
    try:
        contents = await audio.read()
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to read upload: {e}")

    if len(contents) < 1000:
        raise HTTPException(status_code=400, detail="Audio file too short")

    try:
        # Load audio: support WAV; resample to 16kHz if needed
        y, sr = librosa.load(io.BytesIO(contents), sr=TARGET_SR, mono=True)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid audio: {e}")

    if len(y) < 1600:  # 0.1s at 16kHz
        raise HTTPException(status_code=400, detail="Audio too short after load")

    with torch.no_grad():
        inputs = processor(
            y,
            sampling_rate=TARGET_SR,
            return_tensors="pt",
            padding=True,
        )
        input_values = inputs.input_values
        hidden = model(input_values).last_hidden_state
        # Mean pool over time: (1, seq, 768) -> (1, 768)
        embedding = hidden.mean(dim=1).squeeze(0)
        vec: List[float] = embedding.tolist()

    return {"embedding": vec, "dim": len(vec)}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
