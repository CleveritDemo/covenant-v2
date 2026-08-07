# Auto-updater — notas de operación

Covenant Gravity se actualiza solo desde GitHub Releases con
[`electron-updater`](https://www.electron.build/auto-update).

## Cómo funciona

1. La app arranca, espera 5 s y llama a `checkForUpdates()`; repite cada hora
   (`electron/selfUpdate.ts`). Un fallo de red se registra y no se enseña.
2. `electron-updater` lee el feed del repo (`publish` en `package.json`) y baja
   el manifiesto de su plataforma: `latest-mac.yml`, `latest.yml` (Windows) o
   `latest-linux.yml`.
3. Si la versión del manifiesto es mayor que la empaquetada, el renderer pinta
   la píldora en la titlebar (`UpdateBanner.tsx`) con la versión y las notas.
4. Al pulsar *Instalar* se descarga el artefacto y, al terminar, se cierran las
   ventanas por la vía normal (el renderer alcanza a guardar los scrollbacks) y
   se instala y relanza.

En desarrollo no corre: sin `app-update.yml` empaquetado el chequeo solo hace
ruido, así que `registerSelfUpdate()` sale temprano si `!app.isPackaged`.

## Qué artefacto usa cada plataforma

| Plataforma | Se instala a mano con | Se auto-actualiza con |
|---|---|---|
| macOS arm64 | `.dmg` | `.zip` (Squirrel.Mac) |
| Windows x64 | `.exe` (NSIS) | el mismo `.exe` |
| Linux x64 | `.deb` o `.AppImage` | solo `.AppImage` |

Si se quita el target `zip` de macOS o se vuelve a `portable` en Windows, el
updater deja de funcionar en esa plataforma **sin dar error**: simplemente no
encuentra nada que instalar.

## Firma

No hay llaves propias como en el Covenant de Tauri: la confianza es la firma de
plataforma. macOS va firmado con Developer ID y notarizado — **requisito** para
que Squirrel acepte la actualización. Windows todavía no está firmado, así que
SmartScreen avisa en la primera instalación; cuando exista el certificado se
añade el hook `win.sign` y el updater no cambia.

## Publicar una versión

1. Añadir la sección `## vX.Y.Z` a `CHANGELOG.md` (es lo que se ve en el modal
   "Novedades" de la app).
2. Subir `version` en `package.json`.
3. `git tag vX.Y.Z && git push origin vX.Y.Z`.

`.github/workflows/release.yml` hace el resto: `scripts/prepare-release.sh`
extrae las notas a `build/release-notes.md` y crea el release, y cada job
construye con `-p always` para que electron-builder suba binarios **y**
manifiestos.

## Cuando algo falla

- **La app no ve la actualización**: comprobar que el release no está en draft
  (el proveedor de GitHub ignora los drafts) y que el `latest*.yml` de esa
  plataforma está entre los assets.
- **Notas vacías en el modal**: falta la sección del tag en `CHANGELOG.md`.
  Sin ella `releaseNotes` cae al feed Atom de GitHub, que devuelve HTML.
- **Volver atrás**: borrar el release malo. El updater vuelve a resolver el
  anterior, pero quien ya haya actualizado se queda ahí — la única marcha atrás
  real es publicar una versión mayor.
