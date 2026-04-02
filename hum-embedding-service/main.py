"""
Hum Pitch Extraction Service (TorchCrepe-based).

Exposes:
  POST /extract-pitch : accepts WAV file, returns pitch contour + interval sequence
  POST /embed         : (legacy compat) same as /extract-pitch
  GET  /health        : health check

Uses TorchCrepe (PyTorch CREPE reimplementation) for monophonic pitch estimation.
Returns:
  - pitch_contour: list of F0 values in Hz at 10ms steps (0.0 = unvoiced)
  - interval_sequence: semitone deltas between voiced frames (key-invariant)
  - confidence: list of confidence values per frame
"""
import io
import logging
from typing import List, Tuple

import numpy as np
import torch
import librosa
import torchcrepe
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Hum Pitch Extraction Service", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# TorchCrepe operates at 16kHz
TARGET_SR = 16000
MAX_DURATION_SECONDS = 30  # Process up to 30s of audio
# CREPE model size: 'tiny' is fastest (~10x realtime on CPU)
CREPE_MODEL = "tiny"
# Minimum confidence to consider a frame voiced
VOICED_THRESHOLD = 0.3
# Hop size in samples (10ms at 16kHz = 160 samples)
HOP_LENGTH = 160
# RMS threshold for silence detection
SILENCE_RMS_THRESHOLD = 0.01

# Use GPU if available, otherwise CPU
DEVICE = "cuda" if torch.cuda.is_available() else "cpu"


def extract_pitch_contour(
    audio: np.ndarray, sr: int, voiced_threshold: float = VOICED_THRESHOLD
) -> Tuple[List[float], List[float], List[float]]:
    """
    Extract pitch contour from audio using TorchCrepe.

    Returns:
        pitch_hz: F0 in Hz per 10ms frame (0.0 for unvoiced)
        intervals: semitone deltas between consecutive voiced frames (key-invariant)
        confidences: confidence per frame
    """
    # Convert to torch tensor (torchcrepe expects [batch, samples])
    audio_tensor = torch.tensor(audio, dtype=torch.float32).unsqueeze(0).to(DEVICE)

    # Run TorchCrepe prediction
    # Returns pitch (Hz) and periodicity (confidence)
    pitch, periodicity = torchcrepe.predict(
        audio_tensor,
        sr,
        hop_length=HOP_LENGTH,
        model=CREPE_MODEL,
        device=DEVICE,
        return_periodicity=True,
        batch_size=2048,
    )

    # Move to CPU and convert to numpy
    pitch_np = pitch.squeeze(0).cpu().numpy()
    periodicity_np = periodicity.squeeze(0).cpu().numpy()

    # Zero out unvoiced frames (low confidence)
    pitch_hz = []
    for f, c in zip(pitch_np, periodicity_np):
        if c >= voiced_threshold:
            pitch_hz.append(float(round(float(f), 2)))
        else:
            pitch_hz.append(0.0)

    # Compute interval sequence (semitone deltas between voiced frames)
    # This is key-invariant: transposing shifts all pitches but intervals stay the same
    intervals = []
    prev_hz = None
    for hz in pitch_hz:
        if hz > 0:
            if prev_hz is not None and prev_hz > 0:
                semitones = 12.0 * np.log2(hz / prev_hz)
                intervals.append(float(round(float(semitones), 3)))
            prev_hz = hz

    confidences = [float(round(float(c), 4)) for c in periodicity_np]

    return pitch_hz, intervals, confidences


@app.on_event("startup")
def startup():
    logger.info("TorchCrepe model '%s' on device '%s'", CREPE_MODEL, DEVICE)
    # Warm up model with a short dummy audio
    dummy = torch.zeros(1, TARGET_SR).to(DEVICE)  # 1 second of silence
    try:
        torchcrepe.predict(
            dummy, TARGET_SR, hop_length=HOP_LENGTH,
            model=CREPE_MODEL, device=DEVICE, batch_size=2048,
        )
        logger.info("Model warmed up successfully")
    except Exception as e:
        logger.warning("Model warmup failed (will load on first request): %s", e)


@app.get("/health")
def health():
    return {"status": "ok", "model": f"torchcrepe-{CREPE_MODEL}", "device": DEVICE, "version": "2.0.0"}


@app.post("/extract-pitch")
async def extract_pitch(
    audio: UploadFile = File(...),
    voiced_threshold: float = VOICED_THRESHOLD,
) -> dict:
    """
    Accept a WAV file. Return pitch contour and interval sequence.

    Query param `voiced_threshold` controls confidence filtering:
      - 0.3 (default) for monophonic audio (hums, single voice)
      - 0.0 for polyphonic audio (full songs with instruments)
    """
    try:
        contents = await audio.read()
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to read upload: {e}")

    if len(contents) < 1000:
        raise HTTPException(status_code=400, detail="Audio file too short")

    try:
        y, sr = librosa.load(io.BytesIO(contents), sr=TARGET_SR, mono=True)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid audio: {e}")

    if len(y) < TARGET_SR * 0.5:  # less than 0.5s
        raise HTTPException(status_code=400, detail="Audio too short (need at least 0.5s)")

    # Skip leading silence: find where audio actually starts
    # Check 0.5s windows, skip until RMS exceeds threshold
    window_samples = int(TARGET_SR * 0.5)
    skip_samples = 0
    for i in range(0, len(y) - window_samples, window_samples):
        window = y[i : i + window_samples]
        rms = float(np.sqrt(np.mean(window**2)))
        if rms > SILENCE_RMS_THRESHOLD:
            skip_samples = max(0, i - window_samples)  # Keep 0.5s before onset
            break

    if skip_samples > 0:
        logger.info("Skipping %.1fs of leading silence", skip_samples / TARGET_SR)
        y = y[skip_samples:]

    # Trim to max duration
    max_samples = TARGET_SR * MAX_DURATION_SECONDS
    if len(y) > max_samples:
        logger.info(
            "Trimming audio from %.1fs to %ds", len(y) / TARGET_SR, MAX_DURATION_SECONDS
        )
        y = y[:max_samples]

    logger.info(
        "Extracting pitch from %.1fs of audio (voiced_threshold=%.2f)...",
        len(y) / TARGET_SR,
        voiced_threshold,
    )
    pitch_hz, intervals, confidences = extract_pitch_contour(y, TARGET_SR, voiced_threshold)

    voiced_frames = sum(1 for p in pitch_hz if p > 0)
    logger.info(
        "Extracted %d frames (%d voiced), %d intervals",
        len(pitch_hz),
        voiced_frames,
        len(intervals),
    )

    return {
        "pitch_contour": pitch_hz,
        "interval_sequence": intervals,
        "confidence": confidences,
        "num_frames": len(pitch_hz),
        "num_voiced": voiced_frames,
        "num_intervals": len(intervals),
        "duration_seconds": round(len(y) / TARGET_SR, 2),
    }


# Legacy compatibility: /embed still works, returns same data
@app.post("/embed")
async def embed_compat(audio: UploadFile = File(...)) -> dict:
    """Legacy endpoint. Redirects to extract-pitch."""
    return await extract_pitch(audio)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)

