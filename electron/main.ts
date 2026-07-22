import {
  mkdirSync,
  existsSync,
  readFileSync,
  writeFileSync,
  readdirSync,
  accessSync,
  constants,
  statSync,
} from 'fs'
import { join, normalize, resolve, relative, isAbsolute } from 'path'
import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  shell,
} from 'electron'
import { config as loadDotenv } from 'dotenv'
import * as pty from 'node-pty'
import { IPC } from '@shared/ipcChannels'
import type { AppConfig } from '@shared/configSchema'
import { CONFIG_DEFAULTS, mergeWithDefaults, validateConfig } from '@shared/configSchema'
import type { PersistedSession } from './persistence'
import {
  loadSession,
  saveSession,
  loadAiChat,
  saveAiChat,
  deleteAiChat,
  loadCmdHistory,
  saveCmdHistory,
  deleteCmdHistory,
  loadScrollback,
  saveScrollback,
  deleteScrollback,
  loadInteractionsLog,
  saveInteractionsLog,
  deleteInteractionsLog,
  loadAgentChat,
  saveAgentChat,
  deleteAgentChat,
} from './persistence'
import type { AgentChatEntry, AgentCliStartRequest } from '../src/shared/agentCliTypes'
import {
  startAgentTurn,
  isAgentRunActive,
  stopAgentRun,
  stopAgentRunsForWindow,
  stopAllAgentRuns,
  clearAgentContextDeliveryForSession,
} from './agentCliRuntime'
import {
  deleteTabContext,
  discoverTabContexts,
  materializeTabContext,
  mergeAnnotations,
} from './tabContextBuild'
import type {
  TabContextAnnotationRequest,
  TabContextDeleteRequest,
  TabContextDiscoveryRequest,
  TabContextPreviewRequest,
} from '../src/shared/tabContext'
import { gatherProjectAiContextForCwd } from './projectAiContext'
import { readAgentMdForCwd, writeAgentMdForCwd, gatherShallowFolderTree } from './agentMd'
import { applyProjectPatch, readProjectFile, readProjectFileLines, writeProjectFile } from './agentFileOps'
import type { PatchHunk } from './agentFileOps'
import { runAgentShellCommand } from './agentShellOps'
import {
  gitCommit,
  gitDiffForAi,
  gitGetRepoStatus,
  gitPull,
  gitPush,
  gitStageAll,
  gitStageFile,
  gitUnstageAll,
  gitUnstageFile,
} from './gitSessionOps'
import { githubActionsListForSession } from './githubActionsOps'
import { resolveGithubToken } from './githubToken'
import {
  copyPathsForExplorer,
  cutPathsForExplorer,
  pasteIntoExplorer,
} from './fileExplorerClipboardOps'
import {
  createDirForExplorer,
  createFileForExplorer,
  deletePathForExplorer,
  listDirChildren,
  loadFileForExplorer,
  movePathForExplorer,
  renamePathForExplorer,
  revealPathForExplorer,
  saveFileForExplorer,
  searchProjectFiles,
} from './fileExplorerOps'
import {
  startFileExplorerWatch,
  stopAllFileExplorerWatches,
  stopFileExplorerWatch,
} from './fileExplorerWatcher'
import { applyLoginShellPath } from './shellPathEnv'
import { readCdRecentFolders } from './cdRecentMd'

const APP_DISPLAY_NAME = 'AI Terminal'

loadDotenv({ path: resolve(process.cwd(), '.env') })
loadDotenv({ path: resolve(process.cwd(), '.env.local'), override: true })
import {
  clearPersistedSessionCwd,
  clearSessionCdState,
  ensureSessionCdState,
  getSessionCwd,
  initSessionCwd,
  recordCdFromUserLine,
} from './cdRecentCapture'
import {
  extractOsc7CwdFromChunk,
  isExistingDirectory,
  patchEnvForCwdReporting,
} from './shellCwdSync'
import {
  getPlaybackState,
  isSpotifyDesktopInstalled,
  pausePlayback,
  playPlaylist,
  resumePlayback,
  tryResolveSpotifyPlaylistUriFromHttpUrl,
} from './spotifyNative'

function preloadPath(): string {
  return join(__dirname, '../preload/preload.js')
}

function rendererHtmlPath(): string {
  return join(__dirname, '../renderer/index.html')
}

function configPath(): string {
  return join(app.getPath('userData'), 'config.json')
}

function readConfig(): AppConfig {
  const p = configPath()
  if (!existsSync(p)) return CONFIG_DEFAULTS
  try {
    const raw = readFileSync(p, 'utf-8')
    const parsed = JSON.parse(raw) as Partial<AppConfig>
    return mergeWithDefaults(parsed)
  } catch {
    return CONFIG_DEFAULTS
  }
}

function writeConfig(cfg: AppConfig): void {
  mkdirSync(app.getPath('userData'), { recursive: true })
  writeFileSync(configPath(), JSON.stringify(cfg, null, 2), 'utf-8')
}

function projectRootForSession(sessionId: string): string {
  const home = app.getPath('home')
  ensureSessionCdState(sessionId, home)
  const cwd = getSessionCwd(sessionId)?.trim()
  return cwd || home
}

interface PtyEntry {
  proc: pty.IPty
  windowId: number
}

const ptySessions = new Map<string, PtyEntry>()

function killAllPtySessions(): void {
  for (const id of [...ptySessions.keys()]) {
    killPty(id)
  }
}

app.on('before-quit', () => {
  // No matar PTY/agentes aquí: en macOS `close` hace preventDefault y el renderer
  // aún debe guardar sesión/scrollbacks (APP_SAVE_BEFORE_CLOSE) con shells vivos.
  stopAllFileExplorerWatches()
})

app.on('will-quit', () => {
  stopAllAgentRuns()
  killAllPtySessions()
  stopAllFileExplorerWatches()
})

function sendToWindow(windowId: number, channel: string, ...args: unknown[]): void {
  const w = BrowserWindow.getAllWindows().find(b => !b.isDestroyed() && b.id === windowId)
  if (w && !w.isDestroyed()) w.webContents.send(channel, ...args)
}

function killPty(sessionId: string): void {
  const entry = ptySessions.get(sessionId)
  if (entry) {
    try {
      entry.proc.kill()
    } catch {
      /* ignore */
    }
    ptySessions.delete(sessionId)
  }
  clearSessionCdState(sessionId)
}

function resolveShellPath(): string {
  const candidates = [process.env.SHELL, '/bin/zsh', '/bin/bash', '/bin/sh'].filter(
    (p): p is string => Boolean(p && p.trim()),
  )
  for (const p of candidates) {
    try {
      accessSync(p, constants.X_OK)
      return p
    } catch {
      continue
    }
  }
  return '/bin/zsh'
}

function resolveSpawnCwd(requested: unknown, home: string): string {
  if (typeof requested !== 'string' || !requested.trim()) return home
  try {
    const dir = normalize(resolve(requested.trim()))
    const st = statSync(dir)
    if (!st.isDirectory()) return home
    return dir
  } catch {
    return home
  }
}

/** Directorio donde se guardan los archivos de hook de shell (ZDOTDIR temp para zsh, etc.). */
const shellHooksDir = (): string => join(app.getPath('userData'), 'shell-hooks')

function spawnPtyProcess(
  shellPath: string,
  shellArgs: string[],
  cwd: string,
  home: string,
): pty.IPty {
  const baseEnv: Record<string, string> =
    process.platform === 'win32'
      ? (process.env as Record<string, string>)
      : {
          ...process.env as Record<string, string>,
          HOME: home,
          SHELL: shellPath,
          TERM: 'xterm-256color',
          TERM_PROGRAM: 'AI Terminal',
        }

  const env = process.platform === 'win32'
    ? baseEnv
    : patchEnvForCwdReporting(baseEnv, shellPath, shellHooksDir())

  const opts = { name: 'xterm-256color' as const, cwd, env }
  try {
    return pty.spawn(shellPath, shellArgs, opts)
  } catch (firstErr) {
    if (cwd === home) throw firstErr
    return pty.spawn(shellPath, shellArgs, { ...opts, cwd: home })
  }
}

/** PNG en `build/icon.png` (electron-builder). Opcional en dev. */
function resolveOptionalWindowIcon(): string | undefined {
  const png = join(__dirname, '../../build/icon.png')
  try {
    if (existsSync(png)) return png
  } catch {
    /* ignore */
  }
  return undefined
}

function resolvePackagedMacIcon(): string | undefined {
  if (process.platform !== 'darwin') return undefined
  const icns = join(process.resourcesPath, 'icon.icns')
  try {
    if (existsSync(icns)) return icns
  } catch {
    /* ignore */
  }
  return undefined
}

function applyAppBranding(): void {
  app.setName(APP_DISPLAY_NAME)
  if (process.platform !== 'darwin') return
  const icon = resolvePackagedMacIcon() ?? resolveOptionalWindowIcon()
  if (!icon) return
  try {
    app.dock.setIcon(icon)
  } catch {
    /* ignore */
  }
}

function registerIpc(): void {
  ipcMain.handle(IPC.CONFIG_GET, (): AppConfig => readConfig())

  ipcMain.handle(IPC.CONFIG_SET, (_e, partial: Partial<AppConfig>) => {
    const next = mergeWithDefaults({ ...readConfig(), ...partial })
    const errs = validateConfig(next)
    if (errs.length) return { ok: false as const, errors: errs }
    writeConfig(next)
    return { ok: true as const }
  })

  ipcMain.on(IPC.CONFIG_OPEN_FOLDER, () => {
    void shell.openPath(app.getPath('userData'))
  })

  ipcMain.handle(IPC.CD_RECENT_LIST, (): string[] => readCdRecentFolders())

  ipcMain.handle(IPC.CD_RECENT_RECORD_LINE, (_e, sessionId: string, line: string) => {
    return recordCdFromUserLine(sessionId, line, app.getPath('home'))
  })

  ipcMain.handle(IPC.GET_SESSION_CWD, (_e, sessionId: string): string => {
    return getSessionCwd(sessionId) ?? ''
  })

  ipcMain.handle(IPC.LIST_CWD_DIRS, (_e, sessionId: string): string[] => {
    const cwd = projectRootForSession(sessionId)
    try {
      return readdirSync(cwd, { withFileTypes: true })
        .filter(d => d.isDirectory())
        .map(d => `${d.name}/`)
        .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
    } catch {
      return []
    }
  })

  ipcMain.on(IPC.OPEN_FOLDER, (_e, folderPath: unknown) => {
    if (typeof folderPath !== 'string' || !folderPath.trim()) return
    if (folderPath.includes('\0')) return
    const resolved = resolve(folderPath.trim())
    try {
      if (!statSync(resolved).isDirectory()) return
    } catch {
      return
    }
    void shell.openPath(resolved)
  })

  ipcMain.handle(
    IPC.SELECT_DIRECTORY,
    async (
      event,
      options?: { title?: string; defaultPath?: string; withinPath?: string },
    ): Promise<
      | { ok: true; path: string; relativePath?: string }
      | { ok: false; cancelled?: boolean; error?: string }
    > => {
      const win = BrowserWindow.fromWebContents(event.sender)
        ?? BrowserWindow.getFocusedWindow()
        ?? BrowserWindow.getAllWindows()[0]
        ?? null
      const title = typeof options?.title === 'string' && options.title.trim()
        ? options.title.trim()
        : undefined
      const withinPath = typeof options?.withinPath === 'string' && options.withinPath.trim()
        ? resolve(options.withinPath.trim())
        : undefined
      let defaultPath = typeof options?.defaultPath === 'string' && options.defaultPath.trim()
        ? options.defaultPath.trim()
        : withinPath
      if (withinPath && defaultPath && !isAbsolute(defaultPath)) {
        defaultPath = resolve(withinPath, defaultPath)
      }
      const dialogOpts: Electron.OpenDialogOptions = {
        title,
        defaultPath,
        properties: ['openDirectory', 'createDirectory'],
      }
      const result = win
        ? await dialog.showOpenDialog(win, dialogOpts)
        : await dialog.showOpenDialog(dialogOpts)
      if (result.canceled || !result.filePaths[0]) {
        return { ok: false, cancelled: true }
      }
      const selected = resolve(result.filePaths[0])
      try {
        if (!statSync(selected).isDirectory()) {
          return { ok: false, error: 'not a directory' }
        }
      } catch {
        return { ok: false, error: 'path unavailable' }
      }
      if (withinPath) {
        const rel = relative(withinPath, selected)
        if (rel.startsWith('..') || isAbsolute(rel)) {
          return { ok: false, error: 'outside project folder' }
        }
        const relativePath = rel === '' ? '.' : rel.split('\\').join('/')
        return { ok: true, path: selected, relativePath }
      }
      return { ok: true, path: selected }
    },
  )

  ipcMain.handle(IPC.OPEN_EXTERNAL_URL, async (_e, urlStr: unknown) => {
    if (typeof urlStr !== 'string' || !urlStr.trim()) {
      return { ok: false as const, error: 'URL vacía' }
    }
    const raw = urlStr.trim()
    try {
      const u = new URL(raw)
      const isHttp = u.protocol === 'http:' || u.protocol === 'https:'
      const isSpotifyScheme = u.protocol === 'spotify:'
      if (!isHttp && !isSpotifyScheme) {
        return { ok: false as const, error: 'Solo se permiten http(s) y spotify:' }
      }
      if (isHttp) {
        const spotifyUri = tryResolveSpotifyPlaylistUriFromHttpUrl(raw)
        if (spotifyUri && (await isSpotifyDesktopInstalled())) {
          await shell.openExternal(spotifyUri)
          return { ok: true as const }
        }
      }
      await shell.openExternal(raw)
      return { ok: true as const }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      return { ok: false as const, error: msg }
    }
  })

  ipcMain.handle(IPC.SPOTIFY_DESKTOP_INSTALLED, () => isSpotifyDesktopInstalled())

  ipcMain.handle(IPC.SPOTIFY_PLAY_PLAYLIST, async (_e, id: unknown) => {
    if (typeof id !== 'string') return { ok: false as const, error: 'ID inválido' }
    try {
      await playPlaylist(id)
      return { ok: true as const }
    } catch (e) {
      return { ok: false as const, error: e instanceof Error ? e.message : String(e) }
    }
  })

  ipcMain.handle(IPC.SPOTIFY_PAUSE, async () => {
    try {
      await pausePlayback()
      return { ok: true as const }
    } catch (e) {
      return { ok: false as const, error: e instanceof Error ? e.message : String(e) }
    }
  })

  ipcMain.handle(IPC.SPOTIFY_PLAY, async () => {
    try {
      await resumePlayback()
      return { ok: true as const }
    } catch (e) {
      return { ok: false as const, error: e instanceof Error ? e.message : String(e) }
    }
  })

  ipcMain.handle(IPC.SPOTIFY_GET_STATE, () => getPlaybackState())

  ipcMain.handle(IPC.PROJECT_AI_CONTEXT_GET, (_e, sessionId: string) => {
    return gatherProjectAiContextForCwd(projectRootForSession(sessionId))
  })

  ipcMain.handle(IPC.AGENT_MD_READ, (_e, sessionId: string) => {
    return readAgentMdForCwd(projectRootForSession(sessionId))
  })

  ipcMain.handle(IPC.AGENT_MD_WRITE, (_e, sessionId: string, content: string) => {
    return writeAgentMdForCwd(projectRootForSession(sessionId), content)
  })

  ipcMain.handle(IPC.AGENT_MD_TREE, (_e, sessionId: string): string => {
    return gatherShallowFolderTree(projectRootForSession(sessionId))
  })

  ipcMain.handle(
    IPC.AGENT_FILE_READ,
    (_e, sessionId: string, relPath: string, startLine?: number, endLine?: number) => {
      const root = projectRootForSession(sessionId)
      if (typeof startLine === 'number' && typeof endLine === 'number') {
        return readProjectFileLines(root, relPath, { startLine, endLine })
      }
      return readProjectFile(root, relPath)
    },
  )

  ipcMain.handle(IPC.AGENT_FILE_WRITE, (_e, sessionId: string, relPath: string, content: string) => {
    return writeProjectFile(projectRootForSession(sessionId), relPath, content)
  })

  ipcMain.handle(
    IPC.AGENT_FILE_PATCH,
    (_e, sessionId: string, relPath: string, hunks: PatchHunk[]) => {
      return applyProjectPatch(projectRootForSession(sessionId), relPath, hunks)
    },
  )

  ipcMain.handle(
    IPC.AGENT_SHELL_RUN,
    (_e, sessionId: string, command: string, options?: { destructiveConfirmed?: boolean }) => {
      return runAgentShellCommand(projectRootForSession(sessionId), command, options)
    },
  )

  ipcMain.handle(IPC.GIT_STATUS, (_e, sessionId: string) => {
    return gitGetRepoStatus(projectRootForSession(sessionId))
  })
  ipcMain.handle(IPC.GIT_DIFF_FOR_AI, (_e, sessionId: string) => {
    return gitDiffForAi(projectRootForSession(sessionId))
  })
  ipcMain.handle(IPC.GIT_PULL, (_e, sessionId: string) => {
    const result = gitPull(projectRootForSession(sessionId))
    const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
    win?.webContents.send(IPC.GIT_STATUS_CHANGED, sessionId)
    return result
  })
  ipcMain.handle(IPC.GIT_PUSH, (_e, sessionId: string) => {
    const result = gitPush(projectRootForSession(sessionId))
    const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
    win?.webContents.send(IPC.GIT_STATUS_CHANGED, sessionId)
    return result
  })
  ipcMain.handle(IPC.GIT_COMMIT, (_e, sessionId: string, message: unknown) => {
    const result = gitCommit(projectRootForSession(sessionId), message)
    const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
    win?.webContents.send(IPC.GIT_STATUS_CHANGED, sessionId)
    return result
  })
  ipcMain.handle(IPC.GIT_STAGE_ALL, (_e, sessionId: string) => {
    const result = gitStageAll(projectRootForSession(sessionId))
    const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
    win?.webContents.send(IPC.GIT_STATUS_CHANGED, sessionId)
    return result
  })
  ipcMain.handle(IPC.GIT_STAGE_FILE, (_e, sessionId: string, relPath: unknown) => {
    const result = gitStageFile(projectRootForSession(sessionId), relPath)
    const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
    win?.webContents.send(IPC.GIT_STATUS_CHANGED, sessionId)
    return result
  })
  ipcMain.handle(IPC.GIT_UNSTAGE_ALL, (_e, sessionId: string) => {
    const result = gitUnstageAll(projectRootForSession(sessionId))
    const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
    win?.webContents.send(IPC.GIT_STATUS_CHANGED, sessionId)
    return result
  })
  ipcMain.handle(IPC.GIT_UNSTAGE_FILE, (_e, sessionId: string, relPath: unknown) => {
    const result = gitUnstageFile(projectRootForSession(sessionId), relPath)
    const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
    win?.webContents.send(IPC.GIT_STATUS_CHANGED, sessionId)
    return result
  })

  ipcMain.handle(IPC.GITHUB_ACTIONS_LIST, async (_e, sessionId: string) => {
    const token = await resolveGithubToken(readConfig())
    return githubActionsListForSession(projectRootForSession(sessionId), token)
  })

  ipcMain.handle(
    IPC.FILE_EXPLORER_LIST_DIR,
    (_e, sessionId: string, relPath: unknown, showHiddenDirs: unknown) => {
      const rp = typeof relPath === 'string' ? relPath : ''
      const showHidden = showHiddenDirs !== false
      return listDirChildren(projectRootForSession(sessionId), rp, showHidden)
    },
  )

  ipcMain.handle(
    IPC.FILE_EXPLORER_LOAD_FILE,
    (_e, sessionId: string, relPath: unknown, options: unknown) => {
      if (typeof relPath !== 'string' || !relPath.trim()) {
        return { ok: false, relPath: '', error: 'ruta vacía' }
      }
      const opts = options && typeof options === 'object'
        ? { allowLarge: (options as { allowLarge?: boolean }).allowLarge === true }
        : undefined
      return loadFileForExplorer(projectRootForSession(sessionId), relPath, opts)
    },
  )

  ipcMain.handle(
    IPC.FILE_EXPLORER_SAVE_FILE,
    (_e, sessionId: string, relPath: unknown, content: unknown) => {
      if (typeof relPath !== 'string' || !relPath.trim()) {
        return { ok: false, error: 'ruta vacía' }
      }
      if (typeof content !== 'string') {
        return { ok: false, error: 'contenido inválido' }
      }
      return saveFileForExplorer(projectRootForSession(sessionId), relPath, content)
    },
  )

  ipcMain.handle(IPC.FILE_EXPLORER_CREATE_DIR, (_e, sessionId: string, relPath: unknown) => {
    if (typeof relPath !== 'string' || !relPath.trim()) {
      return { ok: false, error: 'ruta vacía' }
    }
    return createDirForExplorer(projectRootForSession(sessionId), relPath)
  })

  ipcMain.handle(IPC.FILE_EXPLORER_CREATE_FILE, (_e, sessionId: string, relPath: unknown) => {
    if (typeof relPath !== 'string' || !relPath.trim()) {
      return { ok: false, error: 'ruta vacía' }
    }
    return createFileForExplorer(projectRootForSession(sessionId), relPath)
  })

  ipcMain.handle(IPC.FILE_EXPLORER_COPY, (_e, sessionId: string, relPaths: unknown) => {
    if (!Array.isArray(relPaths)) {
      return { ok: false, error: 'rutas inválidas' }
    }
    const paths = relPaths.filter((p): p is string => typeof p === 'string' && p.trim().length > 0)
    return copyPathsForExplorer(sessionId, projectRootForSession(sessionId), paths)
  })

  ipcMain.handle(IPC.FILE_EXPLORER_PASTE, (_e, sessionId: string, destRelPath: unknown) => {
    const dest = typeof destRelPath === 'string' ? destRelPath : ''
    return pasteIntoExplorer(sessionId, projectRootForSession(sessionId), dest)
  })

  ipcMain.handle(IPC.FILE_EXPLORER_DELETE, (_e, sessionId: string, relPath: unknown) => {
    if (typeof relPath !== 'string' || !relPath.trim()) {
      return { ok: false, error: 'ruta vacía' }
    }
    return deletePathForExplorer(projectRootForSession(sessionId), relPath)
  })

  ipcMain.handle(
    IPC.FILE_EXPLORER_RENAME,
    (_e, sessionId: string, oldRelPath: unknown, newRelPath: unknown) => {
      if (typeof oldRelPath !== 'string' || !oldRelPath.trim()) {
        return { ok: false, error: 'ruta vacía' }
      }
      if (typeof newRelPath !== 'string' || !newRelPath.trim()) {
        return { ok: false, error: 'nombre inválido' }
      }
      return renamePathForExplorer(
        projectRootForSession(sessionId),
        oldRelPath,
        newRelPath,
      )
    },
  )

  ipcMain.handle(IPC.FILE_EXPLORER_CUT, (_e, sessionId: string, relPaths: unknown) => {
    if (!Array.isArray(relPaths)) {
      return { ok: false, error: 'rutas inválidas' }
    }
    const paths = relPaths.filter((p): p is string => typeof p === 'string' && p.trim().length > 0)
    return cutPathsForExplorer(sessionId, projectRootForSession(sessionId), paths)
  })

  ipcMain.handle(
    IPC.FILE_EXPLORER_MOVE,
    (_e, sessionId: string, oldRelPath: unknown, newRelPath: unknown) => {
      if (typeof oldRelPath !== 'string' || !oldRelPath.trim()) {
        return { ok: false, error: 'ruta vacía' }
      }
      if (typeof newRelPath !== 'string' || !newRelPath.trim()) {
        return { ok: false, error: 'nombre inválido' }
      }
      return movePathForExplorer(
        projectRootForSession(sessionId),
        oldRelPath,
        newRelPath,
      )
    },
  )

  ipcMain.handle(IPC.FILE_EXPLORER_SEARCH, (_e, sessionId: string, query: unknown) => {
    return searchProjectFiles(projectRootForSession(sessionId), query)
  })

  ipcMain.handle(IPC.FILE_EXPLORER_REVEAL, (_e, sessionId: string, relPath: unknown) => {
    if (typeof relPath !== 'string' || !relPath.trim()) {
      return { ok: false, error: 'ruta vacía' }
    }
    const result = revealPathForExplorer(projectRootForSession(sessionId), relPath)
    if (result.ok) {
      shell.showItemInFolder(result.absPath)
    }
    return result
  })

  ipcMain.on(IPC.FILE_EXPLORER_WATCH_START, (_e, sessionId: string) => {
    const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0] ?? null
    startFileExplorerWatch(sessionId, projectRootForSession(sessionId), win)
  })

  ipcMain.on(IPC.FILE_EXPLORER_WATCH_STOP, (_e, sessionId: string) => {
    stopFileExplorerWatch(sessionId)
  })

  ipcMain.handle(IPC.SESSION_LOAD, (): PersistedSession | null => loadSession())

  ipcMain.handle(IPC.SESSION_SAVE, (_e, data: PersistedSession) => {
    saveSession(data)
  })

  ipcMain.handle(IPC.AI_CHAT_LOAD, (_e, paneId: string) => loadAiChat(paneId))
  ipcMain.on(IPC.AI_CHAT_SAVE, (_e, paneId: string, entries: unknown) => {
    saveAiChat(paneId, entries as Parameters<typeof saveAiChat>[1])
  })
  ipcMain.on(IPC.AI_CHAT_DELETE, (_e, paneId: string) => {
    deleteAiChat(paneId)
  })

  ipcMain.handle(IPC.CMD_HISTORY_LOAD, (_e, paneId: string) => loadCmdHistory(paneId))
  ipcMain.on(IPC.CMD_HISTORY_SAVE, (_e, paneId: string, lines: unknown) => {
    saveCmdHistory(paneId, lines as string[])
  })
  ipcMain.on(IPC.CMD_HISTORY_DELETE, (_e, paneId: string) => {
    deleteCmdHistory(paneId)
  })

  ipcMain.handle(IPC.SCROLLBACK_LOAD, (_e, paneId: string) => loadScrollback(paneId))
  ipcMain.on(IPC.SCROLLBACK_SAVE, (_e, paneId: string, data: string) => {
    saveScrollback(paneId, data)
  })
  ipcMain.on(IPC.SCROLLBACK_DELETE, (_e, paneId: string) => {
    deleteScrollback(paneId)
  })

  ipcMain.handle(IPC.INTERACTIONS_LOG_LOAD, (_e, paneId: string) => loadInteractionsLog(paneId))
  ipcMain.on(IPC.INTERACTIONS_LOG_SAVE, (_e, paneId: string, entries: unknown) => {
    saveInteractionsLog(paneId, entries as string[])
  })
  ipcMain.on(IPC.INTERACTIONS_LOG_DELETE, (_e, paneId: string) => {
    deleteInteractionsLog(paneId)
  })

  ipcMain.handle(IPC.AGENT_CHAT_LOAD, (_e, paneId: string) => loadAgentChat(paneId))
  ipcMain.on(IPC.AGENT_CHAT_SAVE, (_e, paneId: string, entries: unknown) => {
    saveAgentChat(paneId, entries as AgentChatEntry[])
  })
  ipcMain.on(IPC.AGENT_CHAT_DELETE, (_e, paneId: string) => {
    deleteAgentChat(paneId)
  })
  ipcMain.on(IPC.AGENT_CONTEXT_DELIVERY_CLEAR, (_e, payload: unknown) => {
    if (!payload || typeof payload !== 'object') return
    const provider = (payload as { provider?: unknown }).provider
    const cliSessionId = (payload as { cliSessionId?: unknown }).cliSessionId
    if ((provider !== 'claude' && provider !== 'cursor') || typeof cliSessionId !== 'string') return
    clearAgentContextDeliveryForSession(provider, cliSessionId)
  })
  ipcMain.handle(IPC.TAB_CONTEXT_PREVIEW, (_event, request: TabContextPreviewRequest) => {
    if (!request || typeof request.cwd !== 'string' || !request.context) {
      return { ok: false, content: '', error: 'Solicitud inválida.' }
    }
    return materializeTabContext(request.context, request.cwd, {
      content: request.content,
    })
  })
  ipcMain.handle(IPC.TAB_CONTEXT_MATERIALIZE, (_event, request: TabContextPreviewRequest) => {
    if (!request || typeof request.cwd !== 'string' || !request.context) {
      return { ok: false, content: '', error: 'Solicitud inválida.' }
    }
    return materializeTabContext(request.context, request.cwd, {
      content: request.content,
      write: true,
    })
  })
  ipcMain.handle(IPC.TAB_CONTEXT_MERGE_ANNOTATIONS, (_event, request: TabContextAnnotationRequest) => {
    if (!request || typeof request.cwd !== 'string' || !request.context || !Array.isArray(request.annotations)) {
      return { ok: false, content: '', error: 'Solicitud inválida.' }
    }
    return mergeAnnotations(request.context, request.cwd, request.annotations)
  })
  ipcMain.handle(IPC.TAB_CONTEXT_DISCOVER, (_event, request: TabContextDiscoveryRequest) => {
    if (!request || typeof request.cwd !== 'string' || !request.cwd.trim()) {
      return { ok: false, contexts: [], error: 'Solicitud inválida.' }
    }
    return discoverTabContexts(request.cwd)
  })
  ipcMain.handle(IPC.TAB_CONTEXT_DELETE, (_event, request: TabContextDeleteRequest) => {
    if (!request || typeof request.cwd !== 'string' || !request.context) {
      return { ok: false, error: 'Solicitud inválida.' }
    }
    return deleteTabContext(request.context, request.cwd)
  })

  ipcMain.on(IPC.AGENT_CLI_START, (event, request: AgentCliStartRequest) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win) return
    const reject = (paneId: string, message: string): void => {
      if (!win.isDestroyed()) {
        win.webContents.send(IPC.AGENT_CLI_EVENT, paneId, { type: 'error', message })
        win.webContents.send(IPC.AGENT_CLI_EVENT, paneId, { type: 'done', code: 1 })
        win.webContents.send(IPC.AGENT_CLI_EXIT, paneId, 1)
      }
    }
    if (!request || typeof request.paneId !== 'string' || typeof request.prompt !== 'string') {
      if (request && typeof request.paneId === 'string') {
        reject(request.paneId, 'Solicitud de agente inválida.')
      }
      return
    }
    if (request.provider !== 'claude' && request.provider !== 'cursor') {
      reject(request.paneId, 'Proveedor de agente no válido.')
      return
    }
    if (!['ask', 'auto', 'plan'].includes(request.permissionMode)) {
      reject(request.paneId, 'Modo de permisos no válido.')
      return
    }
    if (request.model != null && typeof request.model !== 'string') {
      reject(request.paneId, 'Modelo de agente no válido.')
      return
    }
    if (request.images != null) {
      if (!Array.isArray(request.images)) {
        reject(request.paneId, 'Adjuntos de imagen no válidos.')
        return
      }
      for (const image of request.images) {
        if (!image || typeof image !== 'object') {
          reject(request.paneId, 'Adjuntos de imagen no válidos.')
          return
        }
        if (typeof image.name !== 'string' || typeof image.mimeType !== 'string') {
          reject(request.paneId, 'Adjuntos de imagen no válidos.')
          return
        }
        if (typeof image.base64 !== 'string' || !image.base64.trim()) {
          reject(request.paneId, 'Adjuntos de imagen no válidos.')
          return
        }
      }
    }
    startAgentTurn(win, request, readConfig(), app.getPath('home'))
  })
  ipcMain.on(IPC.AGENT_CLI_STOP, (event, paneId: string) => {
    if (typeof paneId !== 'string') return
    const win = BrowserWindow.fromWebContents(event.sender)
    stopAgentRun(paneId, win ? { win, notify: true } : {})
  })
  ipcMain.handle(IPC.AGENT_CLI_IS_ACTIVE, (_event, paneId: string) => {
    return typeof paneId === 'string' && isAgentRunActive(paneId)
  })

  ipcMain.on(IPC.PTY_CREATE, (event, sessionId: string, cwd?: string) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win) return

    // Re-montaje del renderer (reordenar paneles, StrictMode): conservar el shell vivo.
    const existing = ptySessions.get(sessionId)
    if (existing?.windowId === win.id) return

    killPty(sessionId)
    const home = app.getPath('home')
    const initialCwd = resolveSpawnCwd(cwd, home)
    ensureSessionCdState(sessionId, home)
    initSessionCwd(sessionId, initialCwd)

    const shellPath =
      process.platform === 'win32'
        ? process.env.ComSpec || 'cmd.exe'
        : resolveShellPath()
    const shellArgs = process.platform === 'win32' ? [] : ['-l']

    try {
      let spawnCwd = initialCwd
      let proc: pty.IPty
      try {
        proc = spawnPtyProcess(shellPath, shellArgs, spawnCwd, home)
      } catch (firstErr) {
        if (spawnCwd === home) throw firstErr
        spawnCwd = home
        initSessionCwd(sessionId, home)
        proc = spawnPtyProcess(shellPath, shellArgs, home, home)
      }
      const windowId = win.id
      ptySessions.set(sessionId, { proc, windowId })

      proc.onData(data => {
        const oscCwd = extractOsc7CwdFromChunk(data)
        if (oscCwd && isExistingDirectory(oscCwd)) initSessionCwd(sessionId, oscCwd)
        sendToWindow(windowId, IPC.PTY_DATA, sessionId, data)
      })
      proc.onExit(({ exitCode }) => {
        // Ignorar salidas de procesos sustituidos por un pty:create posterior (evita PTY_EXIT
        // espurio → re-spawn en bucle y "posix_spawnp failed." en el renderer).
        const current = ptySessions.get(sessionId)
        if (current?.proc !== proc) return
        ptySessions.delete(sessionId)
        // No borrar cwd aquí: el renderer puede llamar a pty:create de nuevo con el mismo
        // sessionId y GET_SESSION_CWD para reenganchar un shell. killPty() sí limpia el cwd.
        sendToWindow(windowId, IPC.PTY_EXIT, sessionId, exitCode)
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      sendToWindow(win.id, IPC.PTY_ERROR, sessionId, msg)
    }
  })

  ipcMain.on(IPC.PTY_WRITE, (_e, sessionId: string, data: string) => {
    ptySessions.get(sessionId)?.proc.write(data)
  })

  ipcMain.on(IPC.PTY_RESIZE, (_e, sessionId: string, cols: number, rows: number) => {
    const entry = ptySessions.get(sessionId)
    if (entry) {
      try {
        entry.proc.resize(Math.max(1, cols), Math.max(1, rows))
      } catch {
        /* ignore */
      }
    }
  })

  ipcMain.on(IPC.PTY_KILL, (_e, sessionId: string) => {
    killPty(sessionId)
    clearPersistedSessionCwd(sessionId)
    stopFileExplorerWatch(sessionId)
  })
}

function createWindow(): BrowserWindow {
  const icon = resolveOptionalWindowIcon()
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 600,
    minHeight: 400,
    ...(icon ? { icon } : {}),
    backgroundColor: '#0d0d14',
    ...(process.platform === 'darwin'
      ? {
          titleBarStyle: 'hiddenInset' as const,
          trafficLightPosition: { x: 14, y: 14 },
          // Sin vibrancy: con `under-window` + canvas (xterm) en Chromium/Electron a veces
          // el lienzo deja de repintar y no se ve lo que tecleas aunque el PTY sí recibe datos.
        }
      : {}),
    webPreferences: {
      preload: preloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      backgroundThrottling: false,
    },
  })

  win.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown') return
    if (win.webContents.isDevToolsFocused()) return
    const accel = process.platform === 'darwin' ? input.meta : input.control
    if (!accel || input.alt || input.shift) return
    const k = input.key.toLowerCase()
    if (k !== 'w' && input.code !== 'KeyW') return
    event.preventDefault()
    if (!win.isDestroyed()) win.webContents.send(IPC.SHORTCUT_CLOSE_TAB)
  })

  const devUrl = process.env.ELECTRON_RENDERER_URL ?? 'http://localhost:5173'
  if (process.env.NODE_ENV === 'development' || process.env.ELECTRON_RENDERER_URL) {
    void win.loadURL(devUrl)
    if (process.env.ELECTRON_OPEN_DEVTOOLS === '1' || process.env.ELECTRON_OPEN_DEVTOOLS === 'true') {
      win.webContents.openDevTools()
    }
  } else {
    void win.loadFile(rendererHtmlPath())
  }

  let closingFromReady = false
  win.on('close', e => {
    if (closingFromReady) return
    e.preventDefault()
    win.webContents.send(IPC.APP_SAVE_BEFORE_CLOSE)

    const timeout = setTimeout(() => {
      closingFromReady = true
      win.destroy()
    }, 2_000)

    ipcMain.once(IPC.APP_CLOSE_READY, (_ev, scrollbacks: unknown) => {
      clearTimeout(timeout)
      if (scrollbacks && typeof scrollbacks === 'object') {
        for (const [paneId, data] of Object.entries(scrollbacks as Record<string, string>)) {
          if (typeof data === 'string' && data.length) saveScrollback(paneId, data)
        }
      }
      closingFromReady = true
      win.destroy()
    })
  })

  win.on('closed', () => {
    const closedWinId = win.id
    stopAgentRunsForWindow(closedWinId)
    for (const [id, entry] of [...ptySessions.entries()]) {
      if (entry.windowId === closedWinId) {
        killPty(id)
        stopFileExplorerWatch(id)
      }
    }
    // Cerrar la última ventana = salir (también en macOS; no quedarse en el Dock).
    if (BrowserWindow.getAllWindows().length === 0) {
      app.quit()
    }
  })

  return win
}

app.whenReady().then(() => {
  // Dock/Finder no heredan el PATH del shell; sin esto `spawn('agent')` falla con ENOENT.
  applyLoginShellPath()
  applyAppBranding()
  registerIpc()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  // Incluye macOS: no dejar la app viva en el Dock tras cerrar la ventana.
  // Tras close+preventDefault+destroy hay que re-lanzar quit (⌘Q también).
  app.quit()
})
