# Update ready: reinicio manual (no auto-quit)

Fecha: 2026-08-12  
Estado: aprobado en brainstorming; pendiente de plan de implementación

## Problema

Tras pulsar **Instalar**, la descarga termina, el chip pasa un instante a **ready** (botón Restart) y `selfUpdate.ts` llama solo a `quitAndInstall()` porque `installWhenReady` quedó en `true`. El usuario no alcanza a decidir el momento del reinicio; el botón Restart es engañoso.

## Objetivo

- La descarga deja la app en **ready** hasta que el usuario pulse **Restart**.
- Cerrar el chip con la X en `ready` oculta el banner; la actualización descargada sigue disponible y se puede aplicar desde **Ajustes → Actualizaciones**.
- Sin countdown, sin preferencia de auto-restart, sin partir el IPC en dos canales.

## Flujo

1. Estado `available` → **Instalar** → `downloading` (progreso).
2. `update-downloaded` → `ready` + botón Restart. **No** se reinicia solo.
3. Solo **Restart** (chip o modal de notas) → `quitAndInstall()` (cierre ordenado de ventanas + Squirrel, igual que hoy).
4. **X** en `ready` → estado visible `idle` + **stash** en main `{ version, notes }`.
5. En Ajustes, si hay `ready` o stash equivalente: CTA **Reiniciar para actualizar** → mismo path que Restart.
6. **Forzar actualización** / comprobar: si ya hay descarga lista, no reinicia solo; descarga hasta `ready` o expone el CTA de restart.

## Diseño técnico

### `electron/selfUpdate.ts`

- En `update-downloaded`: solo `setState({ kind: 'ready', version, notes })`. Quitar la rama `if (installWhenReady) quitAndInstall()`.
- Eliminar el flag `installWhenReady`.
- Stash privado (módulo): `deferredReady: { version: string; notes: string | null } | null`.
- `UPDATE_DISMISS`:
  - Si `state.kind === 'ready'`, copiar a `deferredReady` y luego `setState({ kind: 'idle' })`.
  - En `available` / `error`: `setState({ kind: 'idle' })` (como hoy). No limpiar un `deferredReady` ajeno en dismiss de error; la limpieza de stash queda en `update-available` / `downloading`.
  - En UI, dismiss sigue oculto durante `downloading`.
- `UPDATE_INSTALL`:
  - `ready` → `quitAndInstall()`.
  - `idle` + `deferredReady` → `quitAndInstall()` (trata como ready).
  - `available` → iniciar `downloadUpdate()` **sin** auto-quit al final.
- `UPDATE_STATE_GET` y el resultado de `UPDATE_CHECK`: si `state.kind === 'idle'` y hay `deferredReady`, hacer `setState({ kind: 'ready', ...deferredReady })` y devolver ese estado. Una sola fuente de verdad: el chip de la titlebar puede reaparecer (aceptable: el usuario volvió a mirar actualizaciones).
- En `update-available` / al pasar a `downloading`: limpiar `deferredReady` si la versión nueva no coincide.
- Actualizar el comentario de cabecera: el usuario decide cuándo reiniciar tras la descarga.
- `isInstallingUpdate` / cierre ordenado: sin cambios.

### `SettingsModal.tsx`

- Suscribirse a `window.api.onUpdateState` (y `getUpdateState` al montar / al entrar en la categoría updates).
- Si `kind === 'ready'`: botón primario **Reiniciar para actualizar** → `installUpdate()`; no usar el copy de “Descargando e instalando…”.
- Si `available` / flujo Forzar: `installUpdate()` solo inicia descarga; al llegar a `ready`, el CTA pasa a reiniciar (misma suscripción).
- Ajustar mensajes i18n EN/ES (`forceUpdateStarting`, nuevas claves del CTA restart, y si hace falta `checkUpdatesFound`).

### Fuera de alcance

- Countdown / “Más tarde” con timer.
- Preferencia “reiniciar automáticamente al terminar”.
- Nuevos canales IPC (`UPDATE_DOWNLOAD` vs `UPDATE_INSTALL`).
- Rediseño visual del chip (cubierto por specs previos del banner).

## Errores

- Fallo de descarga: `error` como hoy; `installWhenReady` ya no existe, así que no hay auto-quit colgado.
- Fallo en `quitAndInstall` / evento `error`: `installing = false` como hoy.
- Stash + nueva versión `available` por chequeo silencioso: sustituir stash por el nuevo flujo (`available` gana; limpiar `deferredReady` al entrar en `available`/`downloading` de otra versión).

## Tests

- `available` → `UPDATE_INSTALL` → `update-downloaded` → **no** llama `quitAndInstall`; estado `ready`.
- `ready` → `UPDATE_INSTALL` → cierra ventanas / `quitAndInstall` (tests existentes se mantienen).
- `ready` → `UPDATE_DISMISS` → `idle` + stash; `UPDATE_INSTALL` o `STATE_GET`/`CHECK` → instala o reporta `ready`.
- Opcional: llegada de `update-available` distinto limpia stash.

## Docs de producto

- Actualizar `docs/AUTO_UPDATER.md` paso 4: descarga y reinicio son dos gestos distintos; dismiss en ready preserva la descarga para Ajustes.
