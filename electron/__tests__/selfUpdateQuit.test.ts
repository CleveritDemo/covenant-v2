import { beforeEach, describe, expect, it, vi } from 'vitest'
import { IPC } from '../../src/shared/ipcChannels'

/** Handlers registrados por registerSelfUpdate, para dispararlos desde el test. */
const ipcOn = new Map<string, (...args: unknown[]) => void>()
const ipcHandle = new Map<string, (...args: unknown[]) => unknown>()
const appOnce = new Map<string, () => void>()
const updaterOn = new Map<string, (...args: unknown[]) => void>()
const quitAndInstall = vi.fn()
const closedWindows: string[] = []

function fakeWindow(id: string) {
  return {
    id,
    isDestroyed: () => false,
    close: () => { closedWindows.push(id) },
    webContents: { send: vi.fn() },
  }
}

let windows: ReturnType<typeof fakeWindow>[] = []

vi.mock('electron', () => ({
  app: {
    isPackaged: true,
    getVersion: () => '0.3.0',
    getPath: () => '/tmp',
    once: (event: string, cb: () => void) => { appOnce.set(event, cb) },
  },
  BrowserWindow: { getAllWindows: () => windows },
  ipcMain: {
    handle: (channel: string, cb: (...args: unknown[]) => unknown) => {
      ipcHandle.set(channel, cb)
    },
    on: (channel: string, cb: (...args: unknown[]) => void) => {
      ipcOn.set(channel, cb)
    },
  },
}))

vi.mock('electron-updater', () => ({
  autoUpdater: {
    autoDownload: true,
    quitAndInstall,
    downloadUpdate: vi.fn(() => Promise.resolve()),
    checkForUpdates: vi.fn(() => Promise.resolve()),
    on: (event: string, cb: (...args: unknown[]) => void) => { updaterOn.set(event, cb) },
  },
}))

const { registerSelfUpdate, isInstallingUpdate } = await import('../selfUpdate')

/** Deja el updater en `ready`, que es el estado desde el que Instalar aplica. */
function makeReady(): void {
  updaterOn.get('update-downloaded')?.({ version: '0.4.0', releaseNotes: '' })
}

describe('quitAndInstall no deja que main mate el proceso antes de tiempo', () => {
  beforeEach(() => {
    ipcOn.clear(); appOnce.clear(); updaterOn.clear()
    quitAndInstall.mockClear()
    closedWindows.length = 0
    windows = [fakeWindow('a'), fakeWindow('b')]
    registerSelfUpdate()
  })

  it('arranca en false: cerrar ventanas normalmente sí debe salir', () => {
    expect(isInstallingUpdate()).toBe(false)
  })

  it('marca la instalación ANTES de cerrar ninguna ventana', () => {
    // Si el flag se pusiera después, el handler `closed` de main.ts ya habría
    // llamado a app.quit() y Squirrel no llegaría a copiar el .app.
    let flagAlPrimerCierre: boolean | null = null
    windows[0].close = () => { flagAlPrimerCierre = isInstallingUpdate() }

    makeReady()
    ipcOn.get(IPC.UPDATE_INSTALL)?.()

    expect(flagAlPrimerCierre).toBe(true)
  })

  it('cierra todas las ventanas y difiere la instalación a window-all-closed', () => {
    makeReady()
    ipcOn.get(IPC.UPDATE_INSTALL)?.()

    expect(closedWindows).toEqual(['a', 'b'])
    expect(quitAndInstall).not.toHaveBeenCalled() // aún no: falta el guardado

    appOnce.get('window-all-closed')?.()
    expect(quitAndInstall).toHaveBeenCalledTimes(1)
  })

  it('sin ventanas instala directamente', () => {
    windows = []
    makeReady()
    ipcOn.get(IPC.UPDATE_INSTALL)?.()

    expect(quitAndInstall).toHaveBeenCalledTimes(1)
  })

  it('un error suelta el flag: la app no puede quedarse sin poder salir', () => {
    makeReady()
    ipcOn.get(IPC.UPDATE_INSTALL)?.()
    expect(isInstallingUpdate()).toBe(true)

    updaterOn.get('error')?.(new Error('falló la copia'))
    expect(isInstallingUpdate()).toBe(false)
  })
})

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
    // El módulo conserva estado entre tests; una versión imposible limpia ready/stash.
    makeAvailable('__test-reset__')
    ipcOn.get(IPC.UPDATE_DISMISS)?.()
    for (const win of windows) {
      (win.webContents.send as ReturnType<typeof vi.fn>).mockClear()
    }
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

    // La descarga no debe disparar instalación; el stash queda en ready.
    expect(quitAndInstall).not.toHaveBeenCalled()
    expect(closedWindows).toEqual([])
    expect(isInstallingUpdate()).toBe(false)
    expect(lastSentState()).toMatchObject({ kind: 'ready', version: '0.4.0' })

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
    expect(lastSentState()).toMatchObject({ kind: 'available', version: '0.5.0' })

    ipcOn.get(IPC.UPDATE_DISMISS)?.()
    const got = await ipcHandle.get(IPC.UPDATE_STATE_GET)?.()
    expect(got).toMatchObject({ kind: 'idle' })
    expect(got).not.toMatchObject({ kind: 'ready', version: '0.4.0' })
  })

  it('update-available de la misma versión que el stash vuelve a ready', async () => {
    makeAvailable('0.4.0')
    ipcOn.get(IPC.UPDATE_INSTALL)?.()
    updaterOn.get('update-downloaded')?.({ version: '0.4.0', releaseNotes: '' })
    ipcOn.get(IPC.UPDATE_DISMISS)?.()

    makeAvailable('0.4.0')
    expect(lastSentState()).toMatchObject({ kind: 'ready', version: '0.4.0' })
  })

  it('update-available de la misma versión conserva el estado ready visible', () => {
    makeReady()

    makeAvailable('0.4.0')

    expect(lastSentState()).toMatchObject({ kind: 'ready', version: '0.4.0' })
  })
})
