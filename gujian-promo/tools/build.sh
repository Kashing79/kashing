#!/usr/bin/env bash
# build.sh — full pipeline: fonts → soundtrack → 500 frames → MP4
set -euo pipefail
cd "$(dirname "$0")/.."
bash tools/fetch-fonts.sh
python3 tools/audio.py build/soundtrack.wav
node tools/render.js
bash tools/encode.sh "${1:-20}" out/gujian-promo.mp4
