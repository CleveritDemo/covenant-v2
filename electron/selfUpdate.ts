// Auto-updater contra GitHub Releases (electron-updater). Chequeo silencioso al
// arrancar y cada hora cuando `autoUpdatesEnabled`; el usuario decide cuándo
// instalar desde el banner o Ajustes → Actualizaciones.
//
// No hay llaves de firma propias: la confianza viene de la firma de plataforma
// (Developer ID + notarización en macOS). En dev no corre — sin `app-update.yml`
// empaquetado, `checkForUpdates()` solo genera ruido.

import { appendFileSync } from 'fs'
import { join } from 'path'
import { app, BrowserWindow, ipcMain } from 'electron'
import { autoUpdater } from 'electron-updater'
import { IPC } from '@shared/ipcChannels'
import type { UpdateState } from '@shared/updateState'
import { formatReleaseNotes, shouldScheduleSilentUpdateChecks } from '@shared/updateState'

const CHECK_INTERVAL_MS = 60 * 60 * 1000
const FIRST_CHECK_DELAY_MS = 5_000

let state: UpdateState = { kind: 'idle' }
/** El usuario pulsó Instalar: al terminar la descarga se sale y se instala. */
let installWhenReady = false
/** Entre el cierre de ventanas y el relevo a Squirrel nadie más puede llamar a `app.quit()`. */
let installing = false
/** Timers del chequeo silencioso (null = parado). */
let firstCheckTimer: ReturnType<typeof setTimeout> | null = null
let intervalTimer: ReturnType<typeof setInterval> | null = null
let silentChecksAllowed = false

/**
 * `true` mientras se está aplicando una actualización. main.ts consulta esto antes
 * de salir: si el proceso muere antes de que Squirrel copie el .app, la
 * actualización no se aplica, la app no se relanza y al reabrir vuelve el banner.
 */
export function isInstallingUpdate(): boolean {
  return installing
}

/** Traza del updater a fichero: sin esto un fallo de instalación no deja rastro. */
function log(message: string): void {
  console.log(`[updater] ${message}`)
  try {
    appendFileSync(
      join(app.getPath('userData'), 'updater.log'),
      `${new Date().toISOString()} ${message}\n`,
      'utf-8',
    )
  } catch { /* ignore */ }
}

function setState(next: UpdateState): void {
  state = next
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send(IPC.UPDATE_STATE, state)
  }
}

/**
 * Sale por la vía normal (`win.close()` dispara el guardado de scrollbacks) y solo
 * entonces instala. `quitAndInstall` a secas mataría ese handshake.
 *
 * `installing` se marca antes de cerrar nada: al destruirse la última ventana,
 * main.ts llamaría a `app.quit()` por dos caminos y el proceso moriría antes de
 * que Squirrel copiase el .app nuevo.
 */
function quitAndInstall(): void {
  installing = true
  const windows = BrowserWindow.getAllWindows().filter(w => !w.isDestroyed())
  log(`instalando: ${windows.length} ventana(s) por cerrar`)
  if (windows.length === 0) {
    autoUpdater.quitAndInstall()
    return
  }
  app.once('window-all-closed', () => {
    log('ventanas cerradas, relevo a Squirrel')
    autoUpdater.quitAndInstall()
  })
  for (const win of windows) win.close()
}

function silentCheck(): void {
  void autoUpdater.checkForUpdates().catch((err: unknown) => {
    console.warn('[updater] chequeo fallido:', err)
  })
}

function stopSilentChecks(): void {
  if (firstCheckTimer) {
    clearTimeout(firstCheckTimer)
    firstCheckTimer = null
  }
  if (intervalTimer) {
    clearInterval(intervalTimer)
    intervalTimer = null
  }
}

function startSilentChecks(): void {
  stopSilentChecks()
  firstCheckTimer = setTimeout(() => {
    firstCheckTimer = null
    silentCheck()
    intervalTimer = setInterval(silentCheck, CHECK_INTERVAL_MS)
  }, FIRST_CHECK_DELAY_MS)
}

/**
 * Activa o para los chequeos silenciosos sin reiniciar la app.
 * El IPC `UPDATE_CHECK` manual sigue disponible siempre.
 */
export function setAutoUpdatesEnabled(enabled: boolean): void {
  if (!app.isPackaged) return
  const allow = shouldScheduleSilentUpdateChecks(enabled)
  if (allow === silentChecksAllowed) return
  silentChecksAllowed = allow
  if (allow) {
    log('chequeos silenciosos ON')
    startSilentChecks()
  } else {
    log('chequeos silenciosos OFF')
    stopSilentChecks()
  }
}

function wireUpdaterEvents(): void {
  autoUpdater.autoDownload = false
  log(`versión actual ${app.getVersion()}`)
  autoUpdater.on('update-available', info => {
    log(`disponible ${info.version}`)
    setState({ kind: 'available', version: info.version, notes: formatReleaseNotes(info.releaseNotes) })
  })
  autoUpdater.on('update-not-available', () => log('sin actualizaciones'))
  autoUpdater.on('download-progress', progress => {
    if (state.kind !== 'downloading') return
    setState({ kind: 'downloading', version: state.version, percent: Math.round(progress.percent) })
  })
  autoUpdater.on('update-downloaded', info => {
    log(`descargada ${info.version}`)
    setState({ kind: 'ready', version: info.version, notes: formatReleaseNotes(info.releaseNotes) })
    if (installWhenReady) quitAndInstall()
  })
  autoUpdater.on('error', err => {
    log(`error: ${err instanceof Error ? err.stack ?? err.message : String(err)}`)
    installing = false
    // Un fallo de red en el chequeo silencioso no debe tapar el banner ya visible.
    if (state.kind === 'idle') return
    setState({ kind: 'error', message: err instanceof Error ? err.message : String(err) })
  })
}

export function registerSelfUpdate(autoUpdatesEnabled = true): void {
  ipcMain.handle(IPC.UPDATE_STATE_GET, () => state)
  ipcMain.on(IPC.UPDATE_INSTALL, () => {
    if (state.kind === 'ready') {
      quitAndInstall()
      return
    }
    if (state.kind !== 'available') return
    installWhenReady = true
    setState({ kind: 'downloading', version: state.version, percent: 0 })
    void autoUpdater.downloadUpdate().catch((err: unknown) => {
      installWhenReady = false
      setState({ kind: 'error', message: err instanceof Error ? err.message : String(err) })
    })
  })
  ipcMain.on(IPC.UPDATE_DISMISS, () => setState({ kind: 'idle' }))
  // Chequeo manual: el fallo se devuelve al que preguntó en vez de pintarse en el
  // banner — un botón que responde «no pude» no debe dejar rastro en la titlebar.
  ipcMain.handle(IPC.UPDATE_CHECK, async (): Promise<UpdateState> => {
    try {
      await autoUpdater.checkForUpdates()
    } catch (err) {
      return { kind: 'error', message: err instanceof Error ? err.message : String(err) }
    }
    return state
  })

  // El banner solo existe con una release real detrás; con esto se puede mirar
  // en dev: GRAVITY_FAKE_UPDATE=1 npm run dev
  if (process.env.GRAVITY_FAKE_UPDATE) {
    setTimeout(() => {
      setState({ kind: 'available', version: '9.9.9', notes: '## Novedades\n\n- Banner de prueba' })
    }, 1_500)
    return
  }

  if (!app.isPackaged) return

  wireUpdaterEvents()
  setAutoUpdatesEnabled(autoUpdatesEnabled)
}
