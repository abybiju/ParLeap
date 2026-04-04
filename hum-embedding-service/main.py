"""
Hum Pitch Extraction Service (TorchCrepe + pYIN fallback).

Exposes:
  POST /extract-pitch : accepts WAV file, returns pitch contour + interval sequence
  POST /embed         : (legacy compat) same as /extract-pitch
  GET  /health        : health check

Uses TorchCrepe (tiny model) as primary pitch extractor.
Falls back to librosa's pYIN when CREPE fails (common with noisy browser audio).

Pre-processing pipeline:
  1. Load and resample to 16kHz
  2. Skip leading silence
  3. Peak-normalize to [-1, 1]
  4. Bandpass filter 80-2000 Hz (vocal pitch range)
  5. Extract pitch via CREPE → if fails, use pYIN
"""
import io
import logging
from typing import List, Tuple

import numpy as np
import torch
import librosa
import torchcrepe
from scipy.signal import butter, sosfilt
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Hum Pitch Extraction Service", version="2.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# TorchCrepe operates at 16kHz
TARGET_SR = 16000
MAX_DURATION_SECONDS = 30
CREPE_MODEL = "tiny"
VOICED_THRESHOLD = 0.15
HOP_LENGTH = 160  # 10ms at 16kHz
SILENCE_RMS_THRESHOLD = 0.01

# pYIN parameters (fallback pitch detector)
PYIN_FMIN = 65.0   # C2 — lowest expected hum pitch
PYIN_FMAX = 800.0  # well above any hum

# Bandpass filter bounds (Hz) for vocal pitch isolation
BP_LOW = 80.0
BP_HIGH = 2000.0

DEVICE = "cuda" if torch.cuda.is_available() else "cpu"

# Pre-compute bandpass filter coefficients (4th-order Butterworth)
_bp_sos = butter(4, [BP_LOW, BP_HIGH], btype="band", fs=TARGET_SR, output="sos")


def preprocess_audio(y: np.ndarray) -> np.ndarray:
    """Normalize amplitude and bandpass filter for pitch extraction."""
    # 1. Peak-normalize to [-1, 1]
    peak = float(np.max(np.abs(y)))
    if peak > 0:
        y = y / peak

    # 2. Bandpass filter to isolate vocal frequencies (removes rumble + hiss)
    y = sosfilt(_bp_sos, y).astype(np.float32)

    # 3. Re-normalize after filtering (filter can change amplitude)
    peak2 = float(np.max(np.abs(y)))
    if peak2 > 0:
        y = y / peak2

    return y


def extract_pitch_crepe(
    audio: np.ndarray, sr: int, voiced_threshold: float = VOICED_THRESHOLD
) -> Tuple[List[float], List[float], List[float]]:
    """Extract pitch contour using TorchCrepe."""
    audio_tensor = torch.tensor(audio, dtype=torch.float32).unsqueeze(0).to(DEVICE)

    pitch, periodicity = torchcrepe.predict(
        audio_tensor,
        sr,
        hop_length=HOP_LENGTH,
        model=CREPE_MODEL,
        device=DEVICE,
        return_periodicity=True,
        batch_size=2048,
    )

    pitch_np = pitch.squeeze(0).cpu().numpy()
    periodicity_np = periodicity.squeeze(0).cpu().numpy()

    # Log periodicity stats for debugging
    if len(periodicity_np) > 0:
        logger.info(
            "CREPE periodicity — mean=%.4f, max=%.4f, >0.1: %d/%d, >0.05: %d/%d",
            float(np.mean(periodicity_np)),
            float(np.max(periodicity_np)),
            int(np.sum(periodicity_np > 0.1)),
            len(periodicity_np),
            int(np.sum(periodicity_np > 0.05)),
            len(periodicity_np),
        )

    pitch_hz: List[float] = []
    for f, c in zip(pitch_np, periodicity_np):
        if c >= voiced_threshold:
            pitch_hz.append(float(round(float(f), 2)))
        else:
            pitch_hz.append(0.0)

    intervals = _compute_intervals(pitch_hz)
    confidences = [float(round(float(c), 4)) for c in periodicity_np]

    return pitch_hz, intervals, confidences


def extract_pitch_pyin(
    audio: np.ndarray, sr: int
) -> Tuple[List[float], List[float], List[float]]:
    """Extract pitch contour using librosa's pYIN (robust fallback for noisy audio)."""
    f0, voiced_flag, voiced_prob = librosa.pyin(
        audio,
        fmin=PYIN_FMIN,
        fmax=PYIN_FMAX,
        sr=sr,
        hop_length=HOP_LENGTH,
        fill_na=0.0,
    )

    pitch_hz: List[float] = []
    for freq, is_voiced in zip(f0, voiced_flag):
        if is_voiced and freq > 0:
            pitch_hz.append(float(round(float(freq), 2)))
        else:
            pitch_hz.append(0.0)

    intervals = _compute_intervals(pitch_hz)
    confidences = [float(round(float(p), 4)) for p in voiced_prob]

    return pitch_hz, intervals, confidences


def _compute_intervals(pitch_hz: List[float]) -> List[float]:
    """Compute semitone deltas between consecutive voiced frames (key-invariant)."""
    intervals: List[float] = []
    prev_hz = None
    for hz in pitch_hz:
        if hz > 0:
            if prev_hz is not None and prev_hz > 0:
                semitones = 12.0 * np.log2(hz / prev_hz)
                intervals.append(float(round(float(semitones), 3)))
            prev_hz = hz
    return intervals


@app.on_event("startup")
def startup():
    logger.info("TorchCrepe model '%s' on device '%s'", CREPE_MODEL, DEVICE)
    dummy = torch.zeros(1, TARGET_SR).to(DEVICE)
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
    return {"status": "ok", "model": f"torchcrepe-{CREPE_MODEL}", "device": DEVICE, "version": "2.1.0"}


@app.post("/extract-pitch")
async def extract_pitch(
    audio: UploadFile = File(...),
    voiced_threshold: float = VOICED_THRESHOLD,
) -> dict:
    """
    Accept a WAV file. Return pitch contour and interval sequence.

    Query param `voiced_threshold` controls confidence filtering:
      - 0.15 (default) for monophonic audio (hums, single voice)
      - 0.0 for polyphonic audio (full songs with instruments)

    Pre-processes audio (normalize + bandpass) before pitch extraction.
    Falls back to pYIN if CREPE detects fewer than 5 voiced frames.
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

    if len(y) < TARGET_SR * 0.5:
        raise HTTPException(status_code=400, detail="Audio too short (need at least 0.5s)")

    # Skip leading silence
    window_samples = int(TARGET_SR * 0.5)
    skip_samples = 0
    for i in range(0, len(y) - window_samples, window_samples):
        window = y[i : i + window_samples]
        rms = float(np.sqrt(np.mean(window**2)))
        if rms > SILENCE_RMS_THRESHOLD:
            skip_samples = max(0, i - window_samples)
            break

    if skip_samples > 0:
        logger.info("Skipping %.1fs of leading silence", skip_samples / TARGET_SR)
        y = y[skip_samples:]

    # Trim to max duration
    max_samples = TARGET_SR * MAX_DURATION_SECONDS
    if len(y) > max_samples:
        logger.info("Trimming audio from %.1fs to %ds", len(y) / TARGET_SR, MAX_DURATION_SECONDS)
        y = y[:max_samples]

    # Diagnostics before preprocessing
    raw_rms = float(np.sqrt(np.mean(y**2)))
    raw_max = float(np.max(np.abs(y)))
    logger.info(
        "Raw audio: %.1fs, rms=%.6f, max_amp=%.4f",
        len(y) / TARGET_SR, raw_rms, raw_max,
    )

    # Pre-process: normalize + bandpass filter
    y_processed = preprocess_audio(y)

    proc_rms = float(np.sqrt(np.mean(y_processed**2)))
    logger.info(
        "After preprocessing: rms=%.6f, voiced_threshold=%.2f",
        proc_rms, voiced_threshold,
    )

    # Try CREPE first
    pitch_hz, intervals, confidences = extract_pitch_crepe(y_processed, TARGET_SR, voiced_threshold)
    voiced_frames = sum(1 for p in pitch_hz if p > 0)
    method = "crepe"

    # Fall back to pYIN if CREPE fails (common with browser audio)
    if voiced_frames < 5 and voiced_threshold > 0:
        logger.info(
            "CREPE found only %d voiced frames — falling back to pYIN",
            voiced_frames,
        )
        pitch_hz, intervals, confidences = extract_pitch_pyin(y_processed, TARGET_SR)
        voiced_frames = sum(1 for p in pitch_hz if p > 0)
        method = "pyin"

    logger.info(
        "[%s] Extracted %d frames (%d voiced), %d intervals",
        method, len(pitch_hz), voiced_frames, len(intervals),
    )

    return {
        "pitch_contour": pitch_hz,
        "interval_sequence": intervals,
        "confidence": confidences,
        "num_frames": len(pitch_hz),
        "num_voiced": voiced_frames,
        "num_intervals": len(intervals),
        "duration_seconds": round(len(y) / TARGET_SR, 2),
        "method": method,
    }


# Legacy compatibility
@app.post("/embed")
async def embed_compat(audio: UploadFile = File(...)) -> dict:
    """Legacy endpoint. Redirects to extract-pitch."""
    return await extract_pitch(audio)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
