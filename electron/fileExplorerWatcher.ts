import { watch, type FSWatcher } from 'fs'
import { resolve, relative, dirname } from 'path'
import type { BrowserWindow } from 'electron'
import { IPC } from '../src/shared/ipcChannels'
import { appendCrashDiagnostics, describeError } from './crashLog'

interface WatcherEntry {
  watcher: FSWatcher
  cwd: string
  win: BrowserWindow | null
  debounceTimer: ReturnType<typeof setTimeout> | null
  pendingDirs: Set<string>
  dirtyWhilePaused: boolean
}

const watchers = new Map<string, WatcherEntry>()
const pauseRefCount = new Map<string, number>()

function isPausedForCwd(cwd: string): boolean {
  return (pauseRefCount.get(cwd) ?? 0) > 0
}

function normalizeRelFromAbs(cwd: string, absPath: string): string {
  const rel = relative(resolve(cwd), absPath).replace(/\\/g, '/')
  if (!rel || rel === '.') return ''
  if (rel.startsWith('..')) return ''
  return rel
}

function parentRelPath(relPath: string): string {
  const idx = relPath.lastIndexOf('/')
  return idx === -1 ? '' : relPath.slice(0, idx)
}

function flushPending(sessionId: string, win: BrowserWindow | null): void {
  const entry = watchers.get(sessionId)
  if (!entry || entry.pendingDirs.size === 0) return
  const dirs = Array.from(entry.pendingDirs)
  entry.pendingDirs.clear()
  entry.debounceTimer = null
  if (win && !win.isDestroyed()) {
    win.webContents.send(IPC.FILE_EXPLORER_FS_CHANGED, sessionId, dirs)
  }
}

export function pauseFileExplorerWatchesForCwd(cwdRaw: string): () => void {
  const cwd = resolve(String(cwdRaw).trim())
  pauseRefCount.set(cwd, (pauseRefCount.get(cwd) ?? 0) + 1)
  let released = false
  return () => {
    if (released) return
    released = true
    const next = (pauseRefCount.get(cwd) ?? 1) - 1
    if (next <= 0) {
      pauseRefCount.delete(cwd)
    } else {
      pauseRefCount.set(cwd, next)
    }
    if (next > 0) return
    for (const [sessionId, entry] of watchers) {
      if (entry.cwd !== cwd) continue
      if (entry.pendingDirs.size > 0 || entry.dirtyWhilePaused) {
        entry.dirtyWhilePaused = false
        entry.pendingDirs.add('')
        flushPending(sessionId, entry.win)
      }
    }
  }
}

export function startFileExplorerWatch(
  sessionId: string,
  cwdRaw: string,
  win: BrowserWindow | null,
): void {
  stopFileExplorerWatch(sessionId)
  const cwd = resolve(String(cwdRaw).trim())
  let watcher: FSWatcher
  try {
    watcher = watch(cwd, { recursive: true }, (_eventType, filename) => {
      if (!filename) return
      const entry = watchers.get(sessionId)
      if (!entry) return
      if (isPausedForCwd(cwd)) {
        entry.dirtyWhilePaused = true
        return
      }
      const abs = resolve(cwd, String(filename))
      const rel = normalizeRelFromAbs(cwd, abs)
      const parent = parentRelPath(rel)
      entry.pendingDirs.add(parent)
      if (entry.debounceTimer) clearTimeout(entry.debounceTimer)
      entry.debounceTimer = setTimeout(() => flushPending(sessionId, entry.win), 300)
    })
  } catch {
    return
  }

  // `FSWatcher` es un EventEmitter: un `'error'` sin listener se relanza como
  // excepción no capturada y **mata la app entera**. Pasa en uso normal — en
  // macOS FSEvents emite error si el directorio observado se borra, se renombra
  // o se desmonta, y hay un watcher por panel de terminal (EMFILE con muchos).
  watcher.on('error', error => {
    appendCrashDiagnostics('file-watcher-error', { sessionId, cwd, ...describeError(error) })
    stopFileExplorerWatch(sessionId)
  })

  watchers.set(sessionId, {
    watcher,
    cwd,
    win,
    debounceTimer: null,
    pendingDirs: new Set(),
    dirtyWhilePaused: false,
  })
}

export function stopFileExplorerWatch(sessionId: string): void {
  const entry = watchers.get(sessionId)
  if (!entry) return
  if (entry.debounceTimer) clearTimeout(entry.debounceTimer)
  try {
    entry.watcher.close()
  } catch {
    // ignore
  }
  watchers.delete(sessionId)
}

export function stopAllFileExplorerWatches(): void {
  for (const sessionId of Array.from(watchers.keys())) {
    stopFileExplorerWatch(sessionId)
  }
}
