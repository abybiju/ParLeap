#!/usr/bin/env bash
#
# First-boot model download for Smart Bible Listen (wake word + Whisper net).
#
# Run before the backend starts (Railway start command / nixpacks). Models are large and are
# NOT baked into the image — they download once to a persistent volume. Idempotent: re-running
# skips anything already present. See BIBLE_WAKE_WORD_PLAN.md.
#
set -euo pipefail

MODELS_DIR="${BIBLE_DETECTOR_MODELS_DIR:-/data/models}"
KWS_DIR="${BIBLE_KWS_MODELS_DIR:-$MODELS_DIR/kws}"
WHISPER_MODEL="${BIBLE_DETECTOR_MODEL:-base.en}"
WHISPER_NET="${BIBLE_DETECTOR_WHISPER_NET:-true}"

KWS_URL="https://github.com/k2-fsa/sherpa-onnx/releases/download/kws-models/sherpa-onnx-kws-zipformer-gigaspeech-3.3M-2024-01-01.tar.bz2"
WHISPER_URL="https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/sherpa-onnx-whisper-${WHISPER_MODEL}.tar.bz2"
VAD_URL="https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models/silero_vad.onnx"

# The committed, tokenized wake vocabulary (…/backend/scripts → …/backend/config).
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
KEYWORDS_SRC="${BIBLE_KWS_KEYWORDS_SRC:-$SCRIPT_DIR/../config/bible-keywords.txt}"

mkdir -p "$KWS_DIR" "$MODELS_DIR"

# 1. Keyword-spotter model (the wake word) — always needed.
if [ ! -f "$KWS_DIR/tokens.txt" ]; then
  echo "[models] downloading KWS model → $KWS_DIR"
  curl -fSL --max-time 300 "$KWS_URL" | tar xj --strip-components=1 -C "$KWS_DIR"
else
  echo "[models] KWS model present, skipping"
fi

# 2. Whisper + VAD (un-cued safety net; Option A). Skipped when BIBLE_DETECTOR_WHISPER_NET=false.
if [ "$WHISPER_NET" != "false" ]; then
  if [ ! -f "$MODELS_DIR/${WHISPER_MODEL}-encoder.int8.onnx" ]; then
    echo "[models] downloading Whisper ${WHISPER_MODEL} → $MODELS_DIR"
    curl -fSL --max-time 600 "$WHISPER_URL" | tar xj --strip-components=1 -C "$MODELS_DIR"
  else
    echo "[models] Whisper ${WHISPER_MODEL} present, skipping"
  fi
  if [ ! -f "$MODELS_DIR/silero_vad.onnx" ]; then
    echo "[models] downloading silero_vad.onnx → $MODELS_DIR"
    curl -fSL --max-time 120 -o "$MODELS_DIR/silero_vad.onnx" "$VAD_URL"
  else
    echo "[models] silero_vad.onnx present, skipping"
  fi
fi

# 3. Install the committed wake vocabulary where the worker looks by default ($KWS_DIR/keywords.txt).
if [ -f "$KEYWORDS_SRC" ]; then
  cp "$KEYWORDS_SRC" "$KWS_DIR/keywords.txt"
  echo "[models] installed keywords.txt ($(grep -cv '^[[:space:]]*$' "$KWS_DIR/keywords.txt") phrases)"
else
  echo "[models] WARNING: keywords source not found at $KEYWORDS_SRC" >&2
fi

echo "[models] ready — KWS=$KWS_DIR  MODELS=$MODELS_DIR  whisperNet=$WHISPER_NET"
