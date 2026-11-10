#!/usr/bin/env bash
# encode.sh — frames + soundtrack → out/gujian-promo.mp4 (H.264 High, yuv420p, BT.709, AAC stereo, faststart)
#   tools/encode.sh [crf] [output]
set -euo pipefail
cd "$(dirname "$0")/.."
CRF="${1:-17}"
OUT="${2:-out/gujian-promo.mp4}"
mkdir -p "$(dirname "$OUT")"
ffmpeg -hide_banner -loglevel error -y \
  -framerate 25 -i build/frames/f_%05d.png -i build/soundtrack.wav \
  -vf "scale=in_range=pc:out_range=tv:out_color_matrix=bt709,format=yuv420p" \
  -c:v libx264 -preset slow -crf "$CRF" -profile:v high -level 4.1 -g 50 -bf 2 \
  -colorspace bt709 -color_primaries bt709 -color_trc bt709 -color_range tv \
  -c:a aac -b:a 256k -ar 48000 -movflags +faststart -shortest "$OUT"
ffprobe -v error -show_entries format=duration,size,bit_rate -of default=nw=1 "$OUT"
