"""
Hum Pitch Extraction Service (TorchCrepe + pYIN fallback + Demucs vocal separation).

Exposes:
  POST /extract-pitch : accepts audio, returns pitch contour + interval sequence
  POST /embed         : (legacy compat) same as /extract-pitch
  GET  /health        : health check

Pipeline for browser hums (monophonic voice):
  1. Load and resample to 16kHz
  2. Skip leading silence, normalize, bandpass 80-2000 Hz
  3. Extract pitch via CREPE → if fails, use pYIN

Pipeline for reference songs (separate_vocals=true):
  1. Load audio at original sample rate
  2. Demucs vocal separation → isolate vocal track
  3. Resample vocals to 16kHz
  4. Same preprocessing + pitch extraction as above

This ensures reference fingerprints and browser hums both represent
isolated vocal melody, making DTW comparison meaningful.
"""
import io
import logging
from typing import List, Optional, Tuple

import numpy as np
import torch
import librosa
import torchcrepe
from scipy.signal import butter, sosfilt
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Hum Pitch Extraction Service", version="3.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Constants ──────────────────────────────────────────────────────────
TARGET_SR = 16000
MAX_DURATION_SECONDS = 30
CREPE_MODEL = "tiny"
VOICED_THRESHOLD = 0.15
HOP_LENGTH = 160  # 10ms at 16kHz
SILENCE_RMS_THRESHOLD = 0.01

PYIN_FMIN = 65.0   # C2
PYIN_FMAX = 800.0

BP_LOW = 80.0
BP_HIGH = 2000.0

DEVICE = "cuda" if torch.cuda.is_available() else "cpu"

# Demucs model — mdx_q is smallest + CPU-friendly
DEMUCS_MODEL = "mdx_q"

# Pre-compute bandpass filter coefficients
_bp_sos = butter(4, [BP_LOW, BP_HIGH], btype="band", fs=TARGET_SR, output="sos")

# Lazy-loaded Demucs model (only initialized when needed)
_demucs_model = None


def _get_demucs_model():
    """Lazy-load Demucs model on first use to save memory."""
    global _demucs_model
    if _demucs_model is None:
        logger.info("Loading Demucs model '%s' (first use)...", DEMUCS_MODEL)
        from demucs.pretrained import get_model
        _demucs_model = get_model(DEMUCS_MODEL)
        _demucs_model.to(DEVICE)
        logger.info("Demucs model loaded (sources: %s)", _demucs_model.sources)
    return _demucs_model


def separate_vocals(audio_bytes: bytes) -> np.ndarray:
    """
    Separate vocal track from a full mix using Demucs.
    Returns mono vocal audio at TARGET_SR (16kHz).
    """
    separator = _get_demucs_separator()

    # Load at original sample rate (Demucs handles resampling internally)
    y, sr = librosa.load(io.BytesIO(audio_bytes), sr=None, mono=False)

    # Demucs expects [channels, samples] tensor
    if y.ndim == 1:
        audio_tensor = torch.from_numpy(y).float().unsqueeze(0)
    else:
        audio_tensor = torch.from_numpy(y).float()

    logger.info("Running Demucs vocal separation (%.1fs audio)...", y.shape[-1] / sr)
    _, separated = separator.separate_tensor(audio_tensor, sr)

    vocals = separated["vocals"]  # [channels, samples]

    # Convert to mono numpy
    if vocals.dim() > 1:
        vocals_mono = vocals.mean(dim=0).numpy()
    else:
        vocals_mono = vocals.numpy()

    # Resample to TARGET_SR
    if sr != TARGET_SR:
        vocals_mono = librosa.resample(vocals_mono, orig_sr=sr, target_sr=TARGET_SR)

    logger.info("Vocal separation complete: %.1fs at %dHz", len(vocals_mono) / TARGET_SR, TARGET_SR)
    return vocals_mono


# ── Audio preprocessing ────────────────────────────────────────────────

def preprocess_audio(y: np.ndarray) -> np.ndarray:
    """Normalize amplitude and bandpass filter for pitch extraction."""
    peak = float(np.max(np.abs(y)))
    if peak > 0:
        y = y / peak

    y = sosfilt(_bp_sos, y).astype(np.float32)

    peak2 = float(np.max(np.abs(y)))
    if peak2 > 0:
        y = y / peak2

    return y


# ── Pitch extraction ──────────────────────────────────────────────────

def extract_pitch_crepe(
    audio: np.ndarray, sr: int, voiced_threshold: float = VOICED_THRESHOLD
) -> Tuple[List[float], List[float], List[float]]:
    """Extract pitch contour using TorchCrepe."""
    audio_tensor = torch.tensor(audio, dtype=torch.float32).unsqueeze(0).to(DEVICE)

    pitch, periodicity = torchcrepe.predict(
        audio_tensor, sr,
        hop_length=HOP_LENGTH,
        model=CREPE_MODEL,
        device=DEVICE,
        return_periodicity=True,
        batch_size=2048,
    )

    pitch_np = pitch.squeeze(0).cpu().numpy()
    periodicity_np = periodicity.squeeze(0).cpu().numpy()

    if len(periodicity_np) > 0:
        logger.info(
            "CREPE periodicity — mean=%.4f, max=%.4f, >0.1: %d/%d, >0.05: %d/%d",
            float(np.mean(periodicity_np)), float(np.max(periodicity_np)),
            int(np.sum(periodicity_np > 0.1)), len(periodicity_np),
            int(np.sum(periodicity_np > 0.05)), len(periodicity_np),
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
    """Extract pitch contour using librosa's pYIN (robust for noisy audio)."""
    f0, voiced_flag, voiced_prob = librosa.pyin(
        audio, fmin=PYIN_FMIN, fmax=PYIN_FMAX,
        sr=sr, hop_length=HOP_LENGTH, fill_na=0.0,
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


# ── FastAPI endpoints ──────────────────────────────────────────────────

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
        logger.warning("Model warmup failed: %s", e)


@app.get("/health")
def health():
    return {
        "status": "ok",
        "model": f"torchcrepe-{CREPE_MODEL}",
        "demucs_model": DEMUCS_MODEL,
        "device": DEVICE,
        "version": "3.0.0",
    }


@app.post("/extract-pitch")
async def extract_pitch(
    audio: UploadFile = File(...),
    voiced_threshold: float = VOICED_THRESHOLD,
    separate_vocals: bool = False,
) -> dict:
    """
    Accept an audio file. Return pitch contour and interval sequence.

    Query params:
      voiced_threshold: confidence filter (0.15 for hums, 0.05 for browser audio)
      separate_vocals: if true, run Demucs to isolate vocals first (use for full-mix songs)

    Pre-processes audio (normalize + bandpass) before pitch extraction.
    Falls back to pYIN if CREPE detects fewer than 5 voiced frames.
    """
    try:
        contents = await audio.read()
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to read upload: {e}")

    if len(contents) < 1000:
        raise HTTPException(status_code=400, detail="Audio file too short")

    # ── Vocal separation (for full-mix reference songs) ──────────────
    if separate_vocals:
        try:
            y = separate_vocals_from_bytes(contents)
        except Exception as e:
            logger.error("Vocal separation failed: %s", e)
            raise HTTPException(status_code=500, detail=f"Vocal separation failed: {e}")
    else:
        try:
            y, _ = librosa.load(io.BytesIO(contents), sr=TARGET_SR, mono=True)
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

    # Diagnostics
    raw_rms = float(np.sqrt(np.mean(y**2)))
    raw_max = float(np.max(np.abs(y)))
    logger.info(
        "Audio: %.1fs, rms=%.6f, max_amp=%.4f, vocals_separated=%s",
        len(y) / TARGET_SR, raw_rms, raw_max, separate_vocals,
    )

    # Pre-process: normalize + bandpass
    y_processed = preprocess_audio(y)

    # Try CREPE first
    pitch_hz, intervals, confidences = extract_pitch_crepe(y_processed, TARGET_SR, voiced_threshold)
    voiced_frames = sum(1 for p in pitch_hz if p > 0)
    method = "crepe"

    # Fall back to pYIN if CREPE fails
    if voiced_frames < 5 and voiced_threshold > 0:
        logger.info("CREPE found only %d voiced frames — falling back to pYIN", voiced_frames)
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
        "vocals_separated": separate_vocals,
    }


def separate_vocals_from_bytes(audio_bytes: bytes) -> np.ndarray:
    """Run Demucs vocal separation and return mono vocals at TARGET_SR."""
    from demucs.apply import apply_model

    model = _get_demucs_model()

    # Load at original SR (Demucs needs high quality, ideally 44.1kHz)
    y, sr = librosa.load(io.BytesIO(audio_bytes), sr=model.samplerate, mono=False)

    # Demucs expects [batch, channels, samples]
    if y.ndim == 1:
        audio_tensor = torch.from_numpy(y).float().unsqueeze(0).unsqueeze(0)  # [1, 1, samples]
    else:
        audio_tensor = torch.from_numpy(y).float().unsqueeze(0)  # [1, channels, samples]

    logger.info("Demucs separating vocals (%.1fs, %dHz, %d channels)...",
                y.shape[-1] / sr, sr, audio_tensor.shape[1])

    # apply_model returns [batch, sources, channels, samples]
    with torch.no_grad():
        sources = apply_model(model, audio_tensor, device=DEVICE, segment=8)

    # Find vocal source index
    vocal_idx = model.sources.index("vocals")
    vocals = sources[0, vocal_idx]  # [channels, samples]

    # To mono numpy
    vocals_mono = vocals.mean(dim=0).cpu().numpy()

    # Resample to TARGET_SR for pitch extraction
    if sr != TARGET_SR:
        vocals_mono = librosa.resample(vocals_mono, orig_sr=sr, target_sr=TARGET_SR)

    vocal_rms = float(np.sqrt(np.mean(vocals_mono**2)))
    logger.info("Vocals isolated: %.1fs, rms=%.6f", len(vocals_mono) / TARGET_SR, vocal_rms)
    return vocals_mono


# Legacy compatibility
@app.post("/embed")
async def embed_compat(audio: UploadFile = File(...)) -> dict:
    return await extract_pitch(audio)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
