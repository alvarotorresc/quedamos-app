#!/usr/bin/env bash
set -euo pipefail

# Uso: verificar-video.sh FICHERO.mp4
# Exige H.264 yuv420p 1920x1080 a 30 fps, audio AAC, 28,5-29,5 s y menos de 3 MB (3 000 000 bytes).
f="$1"
video=$(ffprobe -v error -select_streams v:0 -show_entries stream=codec_name,width,height,r_frame_rate,pix_fmt -of default=nw=1 "$f")
audio=$(ffprobe -v error -select_streams a:0 -show_entries stream=codec_name -of default=nw=1:nk=1 "$f")
duracion=$(ffprobe -v error -show_entries format=duration -of default=nw=1:nk=1 "$f")
bytes=$(stat -c %s "$f")

for esperado in codec_name=h264 width=1920 height=1080 r_frame_rate=30/1 pix_fmt=yuv420p; do
  grep -qx "$esperado" <<<"$video" || { echo "$f: falta $esperado en: $video" >&2; exit 1; }
done
[ "$audio" = "aac" ] || { echo "$f: audio '$audio', se esperaba aac" >&2; exit 1; }
awk -v d="$duracion" 'BEGIN { exit !(d >= 28.5 && d <= 29.5) }' || { echo "$f: dura $duracion s, fuera de 28,5-29,5" >&2; exit 1; }
[ "$bytes" -lt 3000000 ] || { echo "$f: pesa $bytes bytes, el máximo es 3000000" >&2; exit 1; }
echo "ok $f: h264 yuv420p 1920x1080 30 fps, aac, $duracion s, $bytes bytes"
