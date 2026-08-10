#!/usr/bin/env bash
# Compila el helper SFSpeechRecognizer para push-to-talk (solo darwin).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$ROOT/native/mac-dictation/main.swift"
OUT="$ROOT/native/mac-dictation/gravity-mac-dictation"

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "skip mac-dictation: not Darwin" >&2
  exit 0
fi

if [[ ! -f "$SRC" ]]; then
  echo "missing $SRC" >&2
  exit 1
fi

swiftc -O -framework Speech -framework AVFoundation -framework Foundation \
  -o "$OUT" "$SRC"
chmod +x "$OUT"
echo "built $OUT"
