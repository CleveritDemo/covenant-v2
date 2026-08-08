#!/usr/bin/env bash
# Prepara el release antes de que electron-builder publique:
#
#   1. Extrae la sección del tag de CHANGELOG.md a build/release-notes.md.
#      electron-builder recoge ese fichero por nombre (está en buildResources) y
#      lo mete en latest*.yml como `releaseNotes`; electron-updater se lo entrega
#      al banner de la app, que es lo que se ve en "Novedades".
#   2. Crea el release en GitHub con esas mismas notas, para que la página del
#      release y la app digan lo mismo. Los tres jobs de plataforma corren esto
#      en paralelo: el 422 "already exists" de los dos perdedores es el camino
#      esperado.
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
printf '%s\n' "$SECTION" > "$OUT"
echo "── release notes ($OUT)"
cat "$OUT"

case "${GITHUB_REF:-}" in
  refs/tags/v*)
    if [ -n "$(printf '%s' "$SECTION" | tr -d '[:space:]')" ]; then
      gh release create "$TAG" --repo "$REPO" --title "$TAG" --notes-file "$OUT" || true
    else
      gh release create "$TAG" --repo "$REPO" --title "$TAG" --generate-notes || true
    fi
    ;;
  *)
    echo "sin tag: no se crea release"
    ;;
esac
