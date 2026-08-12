# Update ready: reinicio manual — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tras descargar una update, la app se queda en `ready` hasta que el usuario pulse Restart (chip o Ajustes); dismiss oculta el banner pero conserva la descarga.

**Architecture:** Quitar `installWhenReady` en `electron/selfUpdate.ts`. Un stash de módulo `deferredReady` sobrevive al dismiss; `UPDATE_STATE_GET` / `UPDATE_CHECK` / `UPDATE_INSTALL` lo rehidratan o aplican. Settings se suscribe al estado y muestra un CTA de reinicio cuando `kind === 'ready'`. Sin canales IPC nuevos.

**Tech Stack:** TypeScript, Electron, electron-updater, React 18, vitest (`node`), i18n `en`+`es`.

**Spec:** `docs/superpowers/specs/2026-08-12-update-ready-manual-restart-design.md`

## Global Constraints

- Comentarios y docs en **español**; identificadores de código en inglés.
- No partir `UPDATE_INSTALL` en dos canales; no countdown ni preferencia de auto-restart.
- No rediseñar el chip visual (spec 2026-08-11).
- Toda cadena visible: claves nuevas en `src/i18n/locales/en.ts` **y** `es.ts` en el mismo cambio.
- Suite: `npx vitest run electron/__tests__/selfUpdateQuit.test.ts` debe quedar verde; no hace falta la suite entera salvo regresión sospechosa.
- `npx tsc -b` tiene errores previos; no es puerta de paso/fallo — no empeorar el conteo a propósito.
- Commits solo si el usuario lo pide en la sesión de ejecución; los pasos «Commit» del plan quedan como opcionales / al final si se autoriza.

## Estructura de archivos

| Archivo | Responsabilidad | Tarea |
|---|---|---|
| `electron/__tests__/selfUpdateQuit.test.ts` | Harness IPC + casos no-auto-quit, dismiss/stash, restore | 1 |
| `electron/selfUpdate.ts` | Quitar auto-quit; `deferredReady`; handlers | 2 |
| `src/i18n/locales/en.ts`, `es.ts` | Copy Settings restart / force download | 3 |
| `src/renderer/components/SettingsModal.tsx` | Suscripción a update state + CTA reinicio | 3 |
| `docs/AUTO_UPDATER.md` | Flujo en dos gestos | 4 |

---

### Task 1: Tests del updater (fallan primero)

**Files:**
- Modify: `electron/__tests__/selfUpdateQuit.test.ts`

**Interfaces:**
- Consumes: `registerSelfUpdate`, `isInstallingUpdate`, `IPC.UPDATE_*` (existentes).
- Produces: harness con `ipcHandle` + casos que documentan el contrato de Task 2.

- [ ] **Step 1: Extiende el mock de `ipcMain` para capturar `handle`**

En el mock de `electron`, además de `ipcOn`, guarda handlers invoke:

```ts
const ipcHandle = new Map<string, (...args: unknown[]) => unknown>()

// dentro de vi.mock('electron'):
ipcMain: {
  handle: (channel: string, cb: (...args: unknown[]) => unknown) => {
    ipcHandle.set(channel, cb)
  },
  on: (channel: string, cb: (...args: unknown[]) => void) => {
    ipcOn.set(channel, cb)
  },
},
```

En `beforeEach`, también `ipcHandle.clear()`.

- [ ] **Step 2: Añade helpers y describe nuevo**

Debajo de los tests existentes de `quitAndInstall`, añade:

```ts
function lastSentState(): unknown {
  const sends = windows.flatMap(w =>
    (w.webContents.send as ReturnType<typeof vi.fn>).mock.calls
      .filter(c => c[0] === IPC.UPDATE_STATE)
      .map(c => c[1]),
  )
  return sends.at(-1)
}

function makeAvailable(version = '0.4.0'): void {
  updaterOn.get('update-available')?.({ version, releaseNotes: 'notes' })
}

describe('descarga lista sin reinicio automático', () => {
  beforeEach(() => {
    ipcOn.clear(); ipcHandle.clear(); appOnce.clear(); updaterOn.clear()
    quitAndInstall.mockClear()
    closedWindows.length = 0
    windows = [fakeWindow('a')]
    registerSelfUpdate()
  })

  it('tras Instalar + update-downloaded no llama quitAndInstall y queda ready', () => {
    makeAvailable('0.4.0')
    ipcOn.get(IPC.UPDATE_INSTALL)?.()
    expect(lastSentState()).toMatchObject({ kind: 'downloading', version: '0.4.0' })

    updaterOn.get('update-downloaded')?.({ version: '0.4.0', releaseNotes: 'notes' })

    expect(quitAndInstall).not.toHaveBeenCalled()
    expect(lastSentState()).toMatchObject({ kind: 'ready', version: '0.4.0' })
    expect(isInstallingUpdate()).toBe(false)
  })

  it('dismiss en ready pasa a idle; INSTALL desde stash aplica quitAndInstall', () => {
    makeAvailable('0.4.0')
    ipcOn.get(IPC.UPDATE_INSTALL)?.()
    updaterOn.get('update-downloaded')?.({ version: '0.4.0', releaseNotes: 'notes' })
    ipcOn.get(IPC.UPDATE_DISMISS)?.()
    expect(lastSentState()).toMatchObject({ kind: 'idle' })

    ipcOn.get(IPC.UPDATE_INSTALL)?.()
    expect(closedWindows).toEqual(['a'])
    appOnce.get('window-all-closed')?.()
    expect(quitAndInstall).toHaveBeenCalledTimes(1)
  })

  it('STATE_GET con stash restaura ready', async () => {
    makeAvailable('0.4.0')
    ipcOn.get(IPC.UPDATE_INSTALL)?.()
    updaterOn.get('update-downloaded')?.({ version: '0.4.0', releaseNotes: 'hi' })
    ipcOn.get(IPC.UPDATE_DISMISS)?.()

    const got = await ipcHandle.get(IPC.UPDATE_STATE_GET)?.()
    expect(got).toMatchObject({ kind: 'ready', version: '0.4.0' })
    expect(lastSentState()).toMatchObject({ kind: 'ready', version: '0.4.0' })
  })

  it('update-available de otra versión limpia el stash', async () => {
    makeAvailable('0.4.0')
    ipcOn.get(IPC.UPDATE_INSTALL)?.()
    updaterOn.get('update-downloaded')?.({ version: '0.4.0', releaseNotes: '' })
    ipcOn.get(IPC.UPDATE_DISMISS)?.()

    makeAvailable('0.5.0')
    const got = await ipcHandle.get(IPC.UPDATE_STATE_GET)?.()
    expect(got).toMatchObject({ kind: 'available', version: '0.5.0' })
  })

  it('update-available de la misma versión que el stash vuelve a ready', async () => {
    makeAvailable('0.4.0')
    ipcOn.get(IPC.UPDATE_INSTALL)?.()
    updaterOn.get('update-downloaded')?.({ version: '0.4.0', releaseNotes: '' })
    ipcOn.get(IPC.UPDATE_DISMISS)?.()

    makeAvailable('0.4.0')
    expect(lastSentState()).toMatchObject({ kind: 'ready', version: '0.4.0' })
  })
})
```

Los tests de `quitAndInstall` desde `ready` **no se tocan**.

- [ ] **Step 3: Ejecuta y confirma que fallan**

Run:

```bash
npx vitest run electron/__tests__/selfUpdateQuit.test.ts
```

Expected: fallan los casos nuevos (sigue existiendo `installWhenReady` / dismiss sin stash / `STATE_GET` solo devuelve `idle`).

- [ ] **Step 4: Commit (si el usuario lo autoriza)**

```bash
git add electron/__tests__/selfUpdateQuit.test.ts
git commit -m "$(cat <<'EOF'
test: expect manual restart after update download

EOF
)"
```

---

### Task 2: `selfUpdate.ts` — reinicio manual + stash

**Files:**
- Modify: `electron/selfUpdate.ts`

**Interfaces:**
- Consumes: contrato de Task 1.
- Produces:
  - `deferredReady: { version: string; notes: string | null } | null` (privado de módulo)
  - Sin `installWhenReady`
  - `hydrateReadyFromStash(): UpdateState` (privado, opcional helper)

- [ ] **Step 1: Sustituye el estado del módulo**

Quita `installWhenReady`. Añade:

```ts
type DeferredReady = { version: string; notes: string | null }
/** Descarga lista ocultada con dismiss; sobrevive hasta reinicio o versión nueva. */
let deferredReady: DeferredReady | null = null
```

Actualiza el comentario de cabecera del archivo: el usuario decide cuándo reiniciar tras la descarga (dos gestos: Instalar → Restart).

- [ ] **Step 2: Helper de rehidratación**

```ts
function hydrateReadyFromStash(): UpdateState {
  if (state.kind === 'idle' && deferredReady) {
    setState({ kind: 'ready', version: deferredReady.version, notes: deferredReady.notes })
  }
  return state
}
```

- [ ] **Step 3: Ajusta `wireUpdaterEvents`**

```ts
autoUpdater.on('update-available', info => {
  log(`disponible ${info.version}`)
  const notes = formatReleaseNotes(info.releaseNotes)
  if (deferredReady && deferredReady.version === info.version) {
    setState({ kind: 'ready', version: info.version, notes: deferredReady.notes ?? notes })
    return
  }
  deferredReady = null
  setState({ kind: 'available', version: info.version, notes })
})
// ...
autoUpdater.on('update-downloaded', info => {
  log(`descargada ${info.version}`)
  const notes = formatReleaseNotes(info.releaseNotes)
  deferredReady = null // el estado visible ya es la fuente de verdad
  setState({ kind: 'ready', version: info.version, notes })
  // sin quitAndInstall automático
})
```

Al pasar a downloading en `UPDATE_INSTALL`, también `deferredReady = null` (nueva descarga).

- [ ] **Step 4: Reescribe handlers IPC en `registerSelfUpdate`**

```ts
ipcMain.handle(IPC.UPDATE_STATE_GET, () => hydrateReadyFromStash())

ipcMain.on(IPC.UPDATE_INSTALL, () => {
  if (state.kind === 'ready' || (state.kind === 'idle' && deferredReady)) {
    deferredReady = null
    quitAndInstall()
    return
  }
  if (state.kind !== 'available') return
  deferredReady = null
  setState({ kind: 'downloading', version: state.version, percent: 0 })
  void autoUpdater.downloadUpdate().catch((err: unknown) => {
    setState({ kind: 'error', message: err instanceof Error ? err.message : String(err) })
  })
})

ipcMain.on(IPC.UPDATE_DISMISS, () => {
  if (state.kind === 'ready') {
    deferredReady = { version: state.version, notes: state.notes }
  }
  setState({ kind: 'idle' })
})

ipcMain.handle(IPC.UPDATE_CHECK, async (): Promise<UpdateState> => {
  try {
    await autoUpdater.checkForUpdates()
  } catch (err) {
    return { kind: 'error', message: err instanceof Error ? err.message : String(err) }
  }
  return hydrateReadyFromStash()
})
```

- [ ] **Step 5: Ejecuta los tests**

Run:

```bash
npx vitest run electron/__tests__/selfUpdateQuit.test.ts
```

Expected: PASS (suite del archivo completa).

- [ ] **Step 6: Commit (si el usuario lo autoriza)**

```bash
git add electron/selfUpdate.ts electron/__tests__/selfUpdateQuit.test.ts
git commit -m "$(cat <<'EOF'
fix: wait for Restart after update download

EOF
)"
```

---

### Task 3: Settings + i18n

**Files:**
- Modify: `src/i18n/locales/en.ts` (bloque `settings`)
- Modify: `src/i18n/locales/es.ts` (bloque `settings`)
- Modify: `src/renderer/components/SettingsModal.tsx`

**Interfaces:**
- Consumes: `window.api.getUpdateState`, `onUpdateState`, `installUpdate`, `UpdateState`.
- Produces: CTA `settings.restartToUpdate` cuando `updateState.kind === 'ready'`.

- [ ] **Step 1: Claves i18n**

En `en.ts` (`settings`):

```ts
restartToUpdate: 'Restart to update',
forceUpdateStarting: 'Downloading v{{version}}… Restart when it is ready.',
checkUpdatesFound: 'v{{version}} available — use Update now or the title-bar badge.',
checkUpdatesReady: 'v{{version}} downloaded — restart to apply.',
```

(`forceUpdateStarting` y `checkUpdatesFound` ya existen: **reemplaza** el texto de `forceUpdateStarting`; añade `restartToUpdate` y `checkUpdatesReady`.)

En `es.ts`:

```ts
restartToUpdate: 'Reiniciar para actualizar',
forceUpdateStarting: 'Descargando v{{version}}… Reinicia cuando esté lista.',
checkUpdatesFound: 'v{{version}} disponible — usa Forzar actualización o el badge de la titlebar.',
checkUpdatesReady: 'v{{version}} descargada — reinicia para aplicar.',
```

- [ ] **Step 2: Estado de update en SettingsModal**

Junto a `checking` / `forcing` / `checkMsg`:

```ts
const [updateState, setUpdateState] = useState<UpdateState>({ kind: 'idle' })

useEffect(() => {
  void window.api.getUpdateState().then(setUpdateState)
  return window.api.onUpdateState(setUpdateState)
}, [])
```

Importa el tipo `UpdateState` desde `@shared/updateState`.

- [ ] **Step 3: Ajusta `checkUpdates` / `forceUpdate`**

En `checkUpdates`, tras obtener `state`, si `state.kind === 'ready'` usa `t('settings.checkUpdatesReady', { version: state.version })`.

En `forceUpdate`:

```ts
if (state.kind === 'ready') {
  setCheckMsg(t('settings.checkUpdatesReady', { version: state.version }))
  window.api.installUpdate()
  return
}
// available → installUpdate() solo descarga; mensaje forceUpdateStarting
```

Actualiza el comentario JSDoc: ya no es «descarga+instalación» automática hasta el final.

- [ ] **Step 4: CTA en la sección updates**

Sustituye el botón primario único por lógica:

```tsx
{updateState.kind === 'ready' ? (
  <Button
    variant="primary"
    size="sm"
    disabled={checking || forcing}
    onClick={() => window.api.installUpdate()}
  >
    {t('settings.restartToUpdate')}
  </Button>
) : (
  <Button
    variant="primary"
    size="sm"
    disabled={checking || forcing}
    onClick={() => void forceUpdate()}
  >
    {forcing ? t('settings.checkUpdatesRunning') : t('settings.forceUpdate')}
  </Button>
)}
```

Añade `settings.restartToUpdate` al `termKeys` de la entrada `updates` en `SEARCH_INDEX` si quieres que el buscador la encuentre.

- [ ] **Step 5: Verificación estática**

No hay test de componente obligatorio. Comprueba a mano:

1. Las claves nuevas existen en `en.ts` y `es.ts` con la misma forma.
2. `SettingsModal` no importa de `electron/`.
3. Run (opcional): `npx vitest run electron/__tests__/selfUpdateQuit.test.ts` sigue verde.

- [ ] **Step 6: Commit (si el usuario lo autoriza)**

```bash
git add src/i18n/locales/en.ts src/i18n/locales/es.ts src/renderer/components/SettingsModal.tsx
git commit -m "$(cat <<'EOF'
feat: Settings restart CTA when update is ready

EOF
)"
```

---

### Task 4: Doc de operación

**Files:**
- Modify: `docs/AUTO_UPDATER.md`

**Interfaces:**
- Consumes: flujo de Tasks 2–3.
- Produces: doc alineada con reinicio manual.

- [ ] **Step 1: Reescribe el paso 4 de «Cómo funciona»**

Sustituye el bullet que dice que al pulsar Instalar se descarga y se cierra/instala, por algo equivalente a:

```markdown
4. Al pulsar *Instalar* se descarga el artefacto. Al terminar, el chip pasa a
   *ready* con *Restart*; la app **no** se reinicia sola. *Restart* (o
   *Reiniciar para actualizar* en Ajustes) cierra las ventanas por la vía
   normal, guarda scrollbacks e instala. Si se cierra el chip con la X en
   *ready*, la descarga se conserva y se puede aplicar desde Ajustes →
   Actualizaciones.
```

- [ ] **Step 2: Commit (si el usuario lo autoriza)**

```bash
git add docs/AUTO_UPDATER.md
git commit -m "$(cat <<'EOF'
docs: update auto-updater flow for manual restart

EOF
)"
```

---

## Spec coverage (self-review)

| Requisito spec | Task |
|---|---|
| No auto-`quitAndInstall` al terminar descarga | 1, 2 |
| Eliminar `installWhenReady` | 2 |
| Stash en dismiss `ready` | 1, 2 |
| `UPDATE_INSTALL` desde stash / `ready` | 1, 2 |
| `STATE_GET` / `CHECK` rehidratan | 1, 2 |
| Misma versión en `update-available` → `ready` | 1, 2 |
| Otra versión limpia stash | 1, 2 |
| Settings CTA reinicio + i18n | 3 |
| `AUTO_UPDATER.md` | 4 |
| Sin countdown / sin split IPC / sin rediseño chip | (fuera; no hay task) |

## Execution handoff

Plan guardado en `docs/superpowers/plans/2026-08-12-update-ready-manual-restart.md`.
