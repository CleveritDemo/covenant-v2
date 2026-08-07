import { beforeEach, describe, expect, it, vi } from 'vitest'
import { IPC } from '../../src/shared/ipcChannels'

/** Handlers registrados por registerSelfUpdate, para dispararlos desde el test. */
const ipcOn = new Map<string, (...args: unknown[]) => void>()
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
    handle: vi.fn(),
    on: (channel: string, cb: (...args: unknown[]) => void) => { ipcOn.set(channel, cb) },
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
