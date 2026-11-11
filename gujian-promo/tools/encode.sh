#!/usr/bin/env bash
# encode.sh — frames + soundtrack → out/<name>.mp4 (H.264 High, yuv420p, BT.709, AAC stereo, faststart)
#   tools/encode.sh [film] [crf] [output]        film: arch (default) | coins | antiques | tcm
set -euo pipefail
cd "$(dirname "$0")/.."
FILM="${1:-arch}"
CRF="${2:-20}"
case "$FILM" in
  arch) NAME="zhongguo-gujianzhu" ;;
  coins) NAME="zhongguo-guqianbi" ;;
  antiques) NAME="zhongguo-guwan" ;;
  tcm) NAME="zhongyi" ;;
  *) NAME="$FILM" ;;
esac
OUT="${3:-out/$NAME.mp4}"
mkdir -p "$(dirname "$OUT")"
[ -s "build/$FILM/soundtrack.wav" ] || python3 tools/audio.py --film "$FILM" >/dev/null
ffmpeg -hide_banner -loglevel error -y \
  -framerate 25 -i "build/$FILM/frames/f_%05d.png" -i "build/$FILM/soundtrack.wav" \
  -vf "scale=in_range=pc:out_range=tv:out_color_matrix=bt709,format=yuv420p" \
  -c:v libx264 -preset slow -crf "$CRF" -profile:v high -level 4.1 -g 50 -bf 2 \
  -colorspace bt709 -color_primaries bt709 -color_trc bt709 -color_range tv \
  -c:a aac -b:a 256k -ar 48000 -movflags +faststart -shortest "$OUT"
echo "$OUT"
ffprobe -v error -show_entries format=duration,size,bit_rate -of default=nw=1 "$OUT"
