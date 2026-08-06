#!/usr/bin/env bash
set -euo pipefail

SRC="build/icon.png"
DST="build/icon.icns"

if [[ ! -f "$SRC" ]]; then
  echo "Missing source icon: $SRC" >&2
  exit 1
fi

if ! command -v sips >/dev/null 2>&1; then
  echo "sips is required to generate $DST" >&2
  exit 1
fi

if ! command -v iconutil >/dev/null 2>&1; then
  echo "iconutil is required to generate $DST" >&2
  exit 1
fi

ICONSET_DIR="$(mktemp -d /tmp/gravity.iconset.XXXXXX).iconset"
mkdir -p "$ICONSET_DIR"
cleanup() {
  rm -rf "$ICONSET_DIR"
}
trap cleanup EXIT

render_icon() {
  local size="$1"
  local out="$2"
  sips -z "$size" "$size" "$SRC" --out "$out" >/dev/null
}

for size in 16 32 128 256 512; do
  render_icon "$size" "$ICONSET_DIR/icon_${size}x${size}.png"
  render_icon "$((size * 2))" "$ICONSET_DIR/icon_${size}x${size}@2x.png"
done

iconutil -c icns "$ICONSET_DIR" -o "$DST"
echo "Generated $DST from $SRC"
