// Auto-updater contra GitHub Releases (electron-updater). Chequeo silencioso al
// arrancar y cada hora; el usuario decide cuándo instalar desde el banner.
//
// No hay llaves de firma propias: la confianza viene de la firma de plataforma
// (Developer ID + notarización en macOS). En dev no corre — sin `app-update.yml`
// empaquetado, `checkForUpdates()` solo genera ruido.

import { app, BrowserWindow, ipcMain } from 'electron'
import { autoUpdater } from 'electron-updater'
import { IPC } from '@shared/ipcChannels'
import type { UpdateState } from '@shared/updateState'
import { formatReleaseNotes } from '@shared/updateState'

const CHECK_INTERVAL_MS = 60 * 60 * 1000
const FIRST_CHECK_DELAY_MS = 5_000

let state: UpdateState = { kind: 'idle' }
/** El usuario pulsó Instalar: al terminar la descarga se sale y se instala. */
let installWhenReady = false

function setState(next: UpdateState): void {
  state = next
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send(IPC.UPDATE_STATE, state)
  }
}

/**
 * Sale por la vía normal (`win.close()` dispara el guardado de scrollbacks) y solo
 * entonces instala. `quitAndInstall` a secas mataría ese handshake.
 */
function quitAndInstall(): void {
  const windows = BrowserWindow.getAllWindows().filter(w => !w.isDestroyed())
  if (windows.length === 0) {
    autoUpdater.quitAndInstall()
    return
  }
  app.once('window-all-closed', () => autoUpdater.quitAndInstall())
  for (const win of windows) win.close()
}

export function registerSelfUpdate(): void {
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

  // El banner solo existe con una release real detrás; con esto se puede mirar
  // en dev: GRAVITY_FAKE_UPDATE=1 npm run dev
  if (process.env.GRAVITY_FAKE_UPDATE) {
    setTimeout(() => {
      setState({ kind: 'available', version: '9.9.9', notes: '## Novedades\n\n- Banner de prueba' })
    }, 1_500)
    return
  }

  if (!app.isPackaged) return

  autoUpdater.autoDownload = false
  autoUpdater.on('update-available', info => {
    setState({ kind: 'available', version: info.version, notes: formatReleaseNotes(info.releaseNotes) })
  })
  autoUpdater.on('download-progress', progress => {
    if (state.kind !== 'downloading') return
    setState({ kind: 'downloading', version: state.version, percent: Math.round(progress.percent) })
  })
  autoUpdater.on('update-downloaded', info => {
    setState({ kind: 'ready', version: info.version, notes: formatReleaseNotes(info.releaseNotes) })
    if (installWhenReady) quitAndInstall()
  })
  autoUpdater.on('error', err => {
    // Un fallo de red en el chequeo silencioso no debe tapar el banner ya visible.
    if (state.kind === 'idle') return
    setState({ kind: 'error', message: err instanceof Error ? err.message : String(err) })
  })

  const check = (): void => {
    void autoUpdater.checkForUpdates().catch((err: unknown) => {
      console.warn('[updater] chequeo fallido:', err)
    })
  }
  setTimeout(check, FIRST_CHECK_DELAY_MS)
  setInterval(check, CHECK_INTERVAL_MS)
}
