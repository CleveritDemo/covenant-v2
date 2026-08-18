import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const ipcOn = new Map<string, (...args: unknown[]) => void>()
const ipcHandle = new Map<string, (...args: unknown[]) => unknown>()
const updaterOn = vi.fn((event: string, cb: (...args: unknown[]) => void) => {
  void event
  void cb
})
const checkForUpdates = vi.fn(() => Promise.resolve())

vi.mock('electron', () => ({
  app: {
    isPackaged: true,
    getVersion: () => '0.3.0',
    getPath: () => '/tmp',
    once: vi.fn(),
  },
  BrowserWindow: { getAllWindows: () => [] },
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
    quitAndInstall: vi.fn(),
    downloadUpdate: vi.fn(() => Promise.resolve()),
    checkForUpdates,
    on: updaterOn,
  },
}))

const { registerSelfUpdate, isStoreBuild } = await import('../selfUpdate')

function setWindowsStore(value: boolean | undefined): void {
  Object.defineProperty(process, 'windowsStore', {
    configurable: true,
    enumerable: true,
    writable: true,
    value,
  })
}

describe('registerSelfUpdate en build de Microsoft Store', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    ipcOn.clear()
    ipcHandle.clear()
    updaterOn.mockClear()
    checkForUpdates.mockClear()
  })

  afterEach(() => {
    vi.clearAllTimers()
    vi.useRealTimers()
    setWindowsStore(undefined)
  })

  it('con windowsStore true no suscribe autoUpdater ni programa timers', () => {
    setWindowsStore(true)
    expect(isStoreBuild()).toBe(true)

    registerSelfUpdate()

    expect(updaterOn).not.toHaveBeenCalled()
    expect(checkForUpdates).not.toHaveBeenCalled()
    expect(vi.getTimerCount()).toBe(0)
    expect(ipcOn.size).toBe(0)
  })

  it('con windowsStore undefined se comporta como hoy: eventos y chequeo silencioso', () => {
    setWindowsStore(undefined)
    expect(isStoreBuild()).toBe(false)

    registerSelfUpdate()

    expect(updaterOn).toHaveBeenCalled()
    expect(vi.getTimerCount()).toBeGreaterThan(0)
  })
})
