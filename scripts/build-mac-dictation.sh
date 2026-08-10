#!/usr/bin/env bash
# Compila el helper SFSpeechRecognizer para push-to-talk (solo darwin).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DIR="$ROOT/native/mac-dictation"
OUT="$DIR/gravity-mac-dictation"

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "skip mac-dictation: not Darwin" >&2
  exit 0
fi

if [[ ! -f "$DIR/main.swift" || ! -f "$DIR/ExceptionCatcher.m" ]]; then
  echo "missing mac-dictation sources" >&2
  exit 1
fi

swiftc -O \
  -import-objc-header "$DIR/ExceptionCatcher.h" \
  -framework Speech -framework AVFoundation -framework Foundation \
  -o "$OUT" \
  "$DIR/main.swift" "$DIR/ExceptionCatcher.m"
chmod +x "$OUT"
echo "built $OUT"
