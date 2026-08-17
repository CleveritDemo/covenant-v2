#!/usr/bin/env bash
# Prepara el release antes del build / publicación:
#
#   1. Extrae la sección del tag de CHANGELOG.md a build/release-notes.md.
#      electron-builder recoge ese fichero por nombre (está en buildResources) y
#      lo mete en latest*.yml como `releaseNotes`; electron-updater se lo entrega
#      al banner de la app, que es lo que se ve en "Novedades".
#   2. Si CREATE_GITHUB_RELEASE=1, crea el release en GitHub como draft con esas
#      mismas notas. Solo el job publish-release lo hace (una vez); las
#      plataformas solo necesitan el fichero de notas para el build.
set -euo pipefail

TAG="${GITHUB_REF_NAME:-}"
REPO="${GITHUB_REPOSITORY:-CleveritDemo/covenant-v2}"
OUT="build/release-notes.md"

SECTION=""
if [ -f CHANGELOG.md ] && [ -n "$TAG" ]; then
  # awk lee hasta EOF (sin `exit`): cerrar el pipe antes de tiempo mata el script
  # bajo `set -o pipefail`.
  SECTION=$(awk -v tag="$TAG" '
    $0 ~ "^## " tag "([ ]|$)" { grab=1; next }
    grab && /^## / { grab=0 }
    grab { print }
  ' CHANGELOG.md | sed '/./,$!d')
fi

# Sin sección: notas vacías (la app enseña su estado vacío con enlace al release,
# mejor que una URL pelada en el modal) y el release lo escribe GitHub solo.
mkdir -p build
printf '%s\n' "$SECTION" > "$OUT"
echo "── release notes ($OUT)"
cat "$OUT"

if [ "${CREATE_GITHUB_RELEASE:-}" != "1" ]; then
  exit 0
fi

ensure_release() {
  if gh release view "$TAG" --repo "$REPO" >/dev/null 2>&1; then
    return 0
  fi

  local out=""
  local attempt
  for attempt in 1 2 3; do
    if ! out=$(gh release create "$@" 2>&1); then
      if [[ "$out" == *"already exists"* ]]; then
        return 0
      fi
      if [ "$attempt" -eq 1 ]; then
        sleep 5
      elif [ "$attempt" -eq 2 ]; then
        sleep 15
      fi
    else
      return 0
    fi
  done

  if gh release view "$TAG" --repo "$REPO" >/dev/null 2>&1; then
    return 0
  fi
  sleep 5
  if gh release view "$TAG" --repo "$REPO" >/dev/null 2>&1; then
    return 0
  fi
  echo "ERROR: el release $TAG no existe tras 3 intentos de create" >&2
  printf '%s\n' "$out" >&2
  exit 1
}

case "${GITHUB_REF:-}" in
  refs/tags/v*)
    if [ -n "$(printf '%s' "$SECTION" | tr -d '[:space:]')" ]; then
      ensure_release "$TAG" --repo "$REPO" --title "$TAG" --notes-file "$OUT" --draft
    else
      ensure_release "$TAG" --repo "$REPO" --title "$TAG" --generate-notes --draft
    fi
    ;;
  *)
    echo "sin tag: no se crea release"
    ;;
esac
