import {
  mkdirSync,
  existsSync,
  readFileSync,
  writeFileSync,
  readdirSync,
  accessSync,
  appendFileSync,
  constants,
  statSync,
  renameSync,
} from 'fs'
import { join, normalize, resolve, relative, isAbsolute, dirname } from 'path'
import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  session,
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
import {
  listProjectAgents,
  renameProjectAgent,
  upsertProjectAgent,
  deleteProjectAgent,
} from './projectAgentCatalogOps'
import {
  listBrainstormRooms,
  upsertBrainstormRoom,
  deleteBrainstormRoom,
  pruneBrainstormRooms,
  exportBrainstormRoomMarkdown,
} from './brainstormCatalogOps'
import type { ProjectAgentDefinition } from '../src/shared/projectAgentCatalog'
import { isAgentCliProvider, type AgentCliResolution } from '../src/shared/agentCliProviders'
import {
  mcpConfigLabelFor,
  mcpServerSummaries,
  providerUsesProjectMcpConfig,
  type McpServersListRequest,
} from '../src/shared/mcpContext'
import {
  ensureMcpConfigFile,
  mcpConfigPathFor,
  mcpServerNames,
  readMcpConfigFor,
  readProjectMcpConfig,
} from './mcpConfigFile'
import type { BrainstormRoom } from '../src/shared/brainstormRoom'
import type { AgentChatEntry, AgentCliStartRequest } from '../src/shared/agentCliTypes'
import type { AgentCliModelsResult } from '../src/shared/agentCliModels'
import { listAgentCliModels } from './agentCliModelsList'
import { resolveAgentCli } from './agentCliResolve'
import {
  startAgentTurn,
  isAgentRunActive,
  stopAgentRun,
  stopAgentRunsForWindow,
  stopAllAgentRuns,
  clearAgentContextDeliveryForSession,
  clearAgentContextDeliveryState,
  getContextDeliveryMetrics,
} from './agentCliRuntime'
import {
  startBrainstormRoom,
  stopBrainstormRoom,
  pauseBrainstormRoom,
  injectBrainstormHumanMessage,
  stopAllBrainstormRooms,
  stopBrainstormRoomsForWindow,
} from './brainstormRoom'
import type { BrainstormStartConfig } from './brainstormRoom'
import {
  deleteTabContext,
  discoverTabContexts,
  materializeTabContext,
  mergeAnnotations,
} from './tabContextBuild'
import { resolveTabContextRevealPath } from './tabContextReveal'
import { pulseSnapshot, recordPulseEvent } from './pulseStore'
import { clearPresence, setPresence } from './discordPresence'
import { ensureAiAgentResults, writeAiAgentResultsNotes } from './aiAgentResults'
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
  gitDiffFile,
  gitDiffForAi,
  gitDiscardFile,
  gitGetRepoStatus,
  gitListRepos,
  gitCollectUniqueRepos,
  repoAndBranch,
  gitPull,
  gitPush,
  gitStageAll,
  gitStageFile,
  gitUnstageAll,
  gitUnstageFile,
} from './gitSessionOps'
import {
  gitCurrentBranch,
  gitWorktreeAbortMerge,
  gitWorktreeAdd,
  gitWorktreeList,
  gitWorktreeMerge,
  gitWorktreeRemove,
} from './gitWorktreeOps'
import { githubActionsListForSession, githubRunJobsForSession } from './githubActionsOps'
import { fetchGitHubIdentity } from './githubApi'
import type { GitHubRunJobsResult, GitHubTokenCheck } from '../src/shared/githubActionsTypes'
import { resolveGithubToken } from './githubToken'
import {
  cloneOrgWorkspace,
  type OrgWorkspaceCloneRepo,
  type OrgWorkspaceCloneResult,
} from './orgWorkspaceClone'
import {
  addAssignee as covenantAddAssignee,
  addMember as covenantAddMember,
  addOrgAdmin as covenantAddOrgAdmin,
  addWorkspaceAdmin as covenantAddWorkspaceAdmin,
  createOrg as covenantCreateOrg,
  createWorkspace as covenantCreateWorkspace,
  CovenantApiError,
  deleteWorkspace as covenantDeleteWorkspace,
  deleteWorkspaceAgent as covenantDeleteWorkspaceAgent,
  deleteWorkspaceContext as covenantDeleteWorkspaceContext,
  exchange as covenantExchange,
  listDefaults as covenantListDefaults,
  listMembers as covenantListMembers,
  listMemberLogins as covenantListMemberLogins,
  listOrgAdmins as covenantListOrgAdmins,
  listOrgs as covenantListOrgs,
  listWorkspaceAgents as covenantListWorkspaceAgents,
  listWorkspaceContexts as covenantListWorkspaceContexts,
  listWorkspaceRepos as covenantListWorkspaceRepos,
  listWorkspaces as covenantListWorkspaces,
  removeAssignee as covenantRemoveAssignee,
  removeMember as covenantRemoveMember,
  removeOrgAdmin as covenantRemoveOrgAdmin,
  removeWorkspaceAdmin as covenantRemoveWorkspaceAdmin,
  renameWorkspace as covenantRenameWorkspace,
  setDefault as covenantSetDefault,
  signOut as covenantSignOut,
  status as covenantStatus,
  unsetDefault as covenantUnsetDefault,
  upsertWorkspaceAgent as covenantUpsertWorkspaceAgent,
  upsertWorkspaceContext as covenantUpsertWorkspaceContext,
  renameWorkspaceContext as covenantRenameWorkspaceContext,
  addWorkspaceRepo as covenantAddWorkspaceRepo,
  deleteWorkspaceRepo as covenantDeleteWorkspaceRepo,
  initCovenantSession,
} from './covenantApi'
import type { CovenantResult } from '../src/shared/covenantTypes'
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
import { loadFileBytesForExplorer } from './fileExplorerOps'
/** Techo duro del main para cualquier visor, por encima de lo que pida el renderer. */
const FILE_EXPLORER_MAX_PREVIEW_BYTES = 100_000_000
import { applyLoginShellPath } from './shellPathEnv'
import { getDictationRuntime } from './dictationRuntime'
import { readCdRecentFolders } from './cdRecentMd'
import { isInstallingUpdate, registerSelfUpdate, setAutoUpdatesEnabled } from './selfUpdate'
import { decryptField, encryptField, isEncryptedField } from './safeStorageUtils'
import {
  initLspEngine,
  lspDeleteServer,
  lspDownloadServer,
  lspListInstalled,
  lspReadFile,
  lspRecheckRuntimes,
  lspSend,
  lspServerStatus,
  lspStart,
  lspStop,
  lspWriteFile,
  stopAllLspServers,
} from './lsp/lspOps'

const APP_DISPLAY_NAME = 'Covenant Gravity'

// Antes de `whenReady`: `setName` solo mueve `userData` si corre antes del primer
// `getPath`. Sin esto dev usaría `gravity` (name de package.json) y el empaquetado
// `Covenant Gravity` (productName), dos carpetas distintas.
app.setName(APP_DISPLAY_NAME)

/**
 * Rebranding AI Terminal → Covenant Gravity: recupera config/session/historial de
 * la ruta vieja renombrando la carpeta una única vez.
 * ponytail: rename, no copia; si falla arrancamos limpio en la ruta nueva.
 */
function migrateLegacyUserData(): void {
  const target = app.getPath('userData')
  if (existsSync(target)) return
  const parent = dirname(target)
  for (const legacy of ['ai-terminal', 'AI Terminal']) {
    const source = join(parent, legacy)
    try {
      if (!existsSync(source)) continue
      renameSync(source, target)
      return
    } catch {
      /* ignore: se crea limpia */
    }
  }
}

migrateLegacyUserData()

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

/** Campos de AppConfig que se cifran en reposo. */
const SECRET_FIELDS = ['githubToken', 'anthropicApiKey', 'openaiApiKey'] as const
type SecretField = (typeof SECRET_FIELDS)[number]

/** Descifra los campos sensibles de un objeto leído del disco. */
function decryptSecrets(parsed: Partial<AppConfig>): Partial<AppConfig> {
  const out = { ...parsed }
  for (const field of SECRET_FIELDS) {
    const v = out[field]
    if (typeof v === 'string' && v) out[field] = decryptField(v)
  }
  return out
}

/** Migra texto plano a cifrado y re-escribe el archivo si algún campo estaba sin cifrar. */
function maybeMigrateAndEncrypt(parsed: Partial<AppConfig>): Partial<AppConfig> {
  let dirty = false
  const out = { ...parsed }
  for (const field of SECRET_FIELDS) {
    const v = out[field]
    if (typeof v === 'string' && v && !isEncryptedField(v)) {
      out[field] = encryptField(v) as AppConfig[SecretField]
      dirty = true
    }
  }
  if (dirty) {
    try {
      writeFileSync(configPath(), JSON.stringify(out, null, 2), 'utf-8')
    } catch {
      /* ignorar error de escritura en migración */
    }
  }
  return out
}

function readConfig(): AppConfig {
  const p = configPath()
  let withDefaults: AppConfig
  if (!existsSync(p)) {
    withDefaults = { ...CONFIG_DEFAULTS }
  } else {
    try {
      const raw = readFileSync(p, 'utf-8')
      let parsed = JSON.parse(raw) as Partial<AppConfig>
      parsed = maybeMigrateAndEncrypt(parsed)
      parsed = decryptSecrets(parsed)
      withDefaults = mergeWithDefaults(parsed)
    } catch {
      withDefaults = { ...CONFIG_DEFAULTS }
    }
  }
  if (!withDefaults.defaultWorkspacesDir?.trim()) {
    withDefaults.defaultWorkspacesDir = join(app.getPath('documents'), 'covenant')
  }
  return withDefaults
}

function writeConfig(cfg: AppConfig): void {
  mkdirSync(app.getPath('userData'), { recursive: true })
  const toWrite: Partial<AppConfig> = { ...cfg }
  for (const field of SECRET_FIELDS) {
    const v = toWrite[field]
    if (typeof v === 'string' && v) toWrite[field] = encryptField(v) as AppConfig[SecretField]
  }
  writeFileSync(configPath(), JSON.stringify(toWrite, null, 2), 'utf-8')
}

function projectRootForSession(sessionId: string): string {
  const home = app.getPath('home')
  ensureSessionCdState(sessionId, home)
  const cwd = getSessionCwd(sessionId)?.trim()
  return cwd || home
}

/** Raíz fija del explorador por sesión (projectFolder del tab); vacío = seguir el cwd del PTY. */
const explorerRootBySession = new Map<string, string>()

function explorerRootForSession(sessionId: string): string {
  return explorerRootBySession.get(sessionId) || projectRootForSession(sessionId)
}

/** path directo o cwd de la sesión PTY. */
function resolveGitTargetCwd(target: { sessionId?: string; path?: string } | undefined): string {
  const path = typeof target?.path === 'string' ? target.path.trim() : ''
  if (path) return path
  const sessionId = typeof target?.sessionId === 'string' ? target.sessionId : ''
  return projectRootForSession(sessionId)
}

function emitGitStatusChanged(target: { sessionId?: string; path?: string } | undefined): void {
  const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
  const key = (typeof target?.sessionId === 'string' && target.sessionId.trim())
    || (typeof target?.path === 'string' && target.path.trim())
    || ''
  win?.webContents.send(IPC.GIT_STATUS_CHANGED, key)
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
  clearPresence()
  stopAllAgentRuns()
  stopAllBrainstormRooms()
  stopAllLspServers()
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
          TERM_PROGRAM: APP_DISPLAY_NAME,
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
  // `setName` ya se aplicó a nivel de módulo (ver `migrateLegacyUserData`).
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
  const dictation = getDictationRuntime()
  dictation.setEmit((channel, ...args) => {
    for (const w of BrowserWindow.getAllWindows()) {
      if (!w.isDestroyed()) w.webContents.send(channel, ...args)
    }
  })

  ipcMain.handle(IPC.DICTATION_AVAILABLE, () => dictation.availability())
  ipcMain.handle(IPC.DICTATION_REQUEST_PERMISSION, async () => dictation.requestMicrophoneAccess())
  ipcMain.handle(IPC.DICTATION_START, async (_e, lang?: unknown) => {
    const locale = typeof lang === 'string' && lang.trim() ? lang.trim() : 'en-US'
    return dictation.start(locale)
  })
  ipcMain.handle(IPC.DICTATION_STOP, async () => dictation.stop())

  ipcMain.handle(IPC.CONFIG_GET, (): AppConfig => readConfig())

  ipcMain.handle(IPC.CONFIG_SET, (_e, partial: Partial<AppConfig>) => {
    const next = mergeWithDefaults({ ...readConfig(), ...partial })
    const errs = validateConfig(next)
    if (errs.length) return { ok: false as const, errors: errs }
    writeConfig(next)
    setAutoUpdatesEnabled(next.autoUpdatesEnabled)
    return { ok: true as const }
  })

  ipcMain.on(IPC.CONFIG_OPEN_FOLDER, () => {
    void shell.openPath(app.getPath('userData'))
  })

  // Discord no corriendo = fallo esperado; el renderer reintenta al próximo tick.
  ipcMain.handle(
    IPC.DISCORD_PRESENCE_SET,
    async (_e, details: string, state: string, startUnixSecs: number): Promise<boolean> => {
      try {
        await setPresence(details, state, startUnixSecs)
        return true
      } catch {
        return false
      }
    },
  )

  ipcMain.handle(IPC.DISCORD_PRESENCE_CLEAR, (): void => {
    clearPresence()
  })

  ipcMain.handle(IPC.APP_VERSION, (): string => app.getVersion())

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

  ipcMain.handle(IPC.GIT_LIST_REPOS, (_e, dirPath: string) => {
    return gitListRepos(dirPath)
  })
  ipcMain.handle(IPC.GIT_COLLECT_UNIQUE_REPOS, (_e, paths: string[]) => {
    return gitCollectUniqueRepos(Array.isArray(paths) ? paths : [])
  })
  ipcMain.handle(IPC.GIT_STATUS, (_e, target: { sessionId?: string; path?: string }) => {
    return gitGetRepoStatus(resolveGitTargetCwd(target))
  })
  ipcMain.handle(IPC.GIT_DIFF_FOR_AI, (_e, target: { sessionId?: string; path?: string }) => {
    return gitDiffForAi(resolveGitTargetCwd(target))
  })
  ipcMain.handle(
    IPC.GIT_DIFF_FILE,
    (_e, target: { sessionId?: string; path?: string }, relPath: unknown, area: unknown) => {
      const safeArea = area === 'staged' || area === 'untracked' ? area : 'worktree'
      return gitDiffFile(resolveGitTargetCwd(target), relPath, safeArea)
    },
  )
  ipcMain.handle(
    IPC.GIT_DISCARD_FILE,
    (_e, target: { sessionId?: string; path?: string }, relPath: unknown, untracked: unknown) => {
      const result = gitDiscardFile(resolveGitTargetCwd(target), relPath, untracked === true)
      emitGitStatusChanged(target)
      return result
    },
  )
  ipcMain.handle(IPC.GIT_PULL, (_e, target: { sessionId?: string; path?: string }) => {
    const result = gitPull(resolveGitTargetCwd(target))
    emitGitStatusChanged(target)
    return result
  })
  ipcMain.handle(IPC.GIT_PUSH, (_e, target: { sessionId?: string; path?: string }) => {
    const result = gitPush(resolveGitTargetCwd(target))
    emitGitStatusChanged(target)
    return result
  })
  ipcMain.handle(IPC.PULSE_SNAPSHOT, (_e, scope: unknown) => {
    // El alcance viene del renderer: se aceptan solo strings, el resto se ignora.
    const raw = (scope ?? {}) as Record<string, unknown>
    const pick = (key: string): string | undefined =>
      typeof raw[key] === 'string' && raw[key] ? (raw[key] as string) : undefined
    return pulseSnapshot({
      workspace: pick('workspace'),
      repo: pick('repo'),
      sinceDay: pick('sinceDay'),
    })
  })

  // ─── LSP ────────────────────────────────────────────────────────────────
  ipcMain.handle(IPC.LSP_SERVER_STATUS, (_e, language: unknown) =>
    lspServerStatus(typeof language === 'string' ? language : ''))
  ipcMain.handle(IPC.LSP_DOWNLOAD_SERVER, (_e, language: unknown) =>
    lspDownloadServer(typeof language === 'string' ? language : ''))
  ipcMain.handle(IPC.LSP_LIST_INSTALLED, () => lspListInstalled())
  ipcMain.handle(IPC.LSP_DELETE_SERVER, (_e, language: unknown) =>
    lspDeleteServer(typeof language === 'string' ? language : ''))
  ipcMain.handle(IPC.LSP_RECHECK_RUNTIMES, () => lspRecheckRuntimes())
  ipcMain.handle(IPC.LSP_START, (_e, sessionId: unknown, relPath: unknown) => {
    if (typeof sessionId !== 'string' || typeof relPath !== 'string' || !relPath.trim()) {
      return { ok: false, error: 'ruta vacía' }
    }
    return lspStart(explorerRootForSession(sessionId), relPath)
  })
  ipcMain.on(IPC.LSP_SEND, (_e, serverId: unknown, message: unknown) => {
    if (typeof serverId !== 'number' || typeof message !== 'string') return
    lspSend(serverId, message)
  })
  ipcMain.on(IPC.LSP_STOP, (_e, serverId: unknown) => {
    if (typeof serverId !== 'number') return
    lspStop(serverId)
  })
  ipcMain.handle(IPC.LSP_READ_FILE, (_e, serverId: unknown, absPath: unknown) => {
    if (typeof serverId !== 'number' || typeof absPath !== 'string') {
      return { ok: false, error: 'argumentos inválidos' }
    }
    return lspReadFile(serverId, absPath)
  })
  ipcMain.handle(IPC.LSP_WRITE_FILE, (_e, serverId: unknown, absPath: unknown, content: unknown) => {
    if (typeof serverId !== 'number' || typeof absPath !== 'string' || typeof content !== 'string') {
      return { ok: false, error: 'argumentos inválidos' }
    }
    return lspWriteFile(serverId, absPath, content)
  })
  ipcMain.handle(IPC.GIT_COMMIT, async (
    _e,
    target: { sessionId?: string; path?: string },
    message: unknown,
    meta: unknown,
  ) => {
    const cwd = resolveGitTargetCwd(target)
    const result = await gitCommit(cwd, message)
    emitGitStatusChanged(target)
    if (result.ok) {
      const tag = (meta ?? {}) as Record<string, unknown>
      const str = (key: string): string | undefined =>
        typeof tag[key] === 'string' && tag[key] ? (tag[key] as string) : undefined
      recordPulseEvent({
        ts: Date.now(),
        kind: 'commit',
        ...(await repoAndBranch(cwd)),
        ...(str('agentId') ? { agentId: str('agentId') } : {}),
        ...(str('workspace') ? { workspace: str('workspace') } : {}),
      })
    }
    return result
  })
  ipcMain.handle(IPC.GIT_STAGE_ALL, (_e, target: { sessionId?: string; path?: string }) => {
    const result = gitStageAll(resolveGitTargetCwd(target))
    emitGitStatusChanged(target)
    return result
  })
  ipcMain.handle(IPC.GIT_STAGE_FILE, (_e, target: { sessionId?: string; path?: string }, relPath: unknown) => {
    const result = gitStageFile(resolveGitTargetCwd(target), relPath)
    emitGitStatusChanged(target)
    return result
  })
  ipcMain.handle(IPC.GIT_UNSTAGE_ALL, (_e, target: { sessionId?: string; path?: string }) => {
    const result = gitUnstageAll(resolveGitTargetCwd(target))
    emitGitStatusChanged(target)
    return result
  })
  ipcMain.handle(IPC.GIT_UNSTAGE_FILE, (_e, target: { sessionId?: string; path?: string }, relPath: unknown) => {
    const result = gitUnstageFile(resolveGitTargetCwd(target), relPath)
    emitGitStatusChanged(target)
    return result
  })

  ipcMain.handle(IPC.GIT_CURRENT_BRANCH, (_e, target: { sessionId?: string; path?: string }) => {
    return gitCurrentBranch(resolveGitTargetCwd(target))
  })
  ipcMain.handle(
    IPC.GIT_WORKTREE_ADD,
    (
      _e,
      target: { sessionId?: string; path?: string },
      request: { worktreePath: string; branch: string; fromRef: string },
    ) => {
      return gitWorktreeAdd(resolveGitTargetCwd(target), request)
    },
  )
  ipcMain.handle(
    IPC.GIT_WORKTREE_MERGE,
    (
      _e,
      target: { sessionId?: string; path?: string },
      request: { branch: string; message: string },
    ) => {
      return gitWorktreeMerge(resolveGitTargetCwd(target), request)
    },
  )
  ipcMain.handle(IPC.GIT_WORKTREE_ABORT_MERGE, (_e, target: { sessionId?: string; path?: string }) => {
    return gitWorktreeAbortMerge(resolveGitTargetCwd(target))
  })
  ipcMain.handle(
    IPC.GIT_WORKTREE_REMOVE,
    (
      _e,
      target: { sessionId?: string; path?: string },
      request: { worktreePath: string; branch: string; force?: boolean },
    ) => {
      return gitWorktreeRemove(resolveGitTargetCwd(target), request)
    },
  )
  ipcMain.handle(IPC.GIT_WORKTREE_LIST, (_e, target: { sessionId?: string; path?: string }) => {
    return gitWorktreeList(resolveGitTargetCwd(target))
  })

  ipcMain.handle(IPC.GITHUB_ACTIONS_LIST, async (_e, target: { sessionId?: string; path?: string }) => {
    const token = await resolveGithubToken(readConfig())
    return githubActionsListForSession(resolveGitTargetCwd(target), token)
  })

  ipcMain.handle(
    IPC.GITHUB_RUN_JOBS,
    async (_e, target: { sessionId?: string; path?: string }, runId: unknown): Promise<GitHubRunJobsResult> => {
      if (typeof runId !== 'number' || !Number.isFinite(runId)) {
        return { ok: false, jobs: [], error: 'runId inválido' }
      }
      const token = await resolveGithubToken(readConfig())
      return githubRunJobsForSession(resolveGitTargetCwd(target), token, runId)
    },
  )

  async function covenantInvoke<T>(fn: () => Promise<T> | T): Promise<CovenantResult<T>> {
    try {
      return { ok: true, data: await fn() }
    } catch (e) {
      if (e instanceof CovenantApiError) {
        return { ok: false, error: e.message }
      }
      return { ok: false, error: e instanceof Error ? e.message : String(e) }
    }
  }

  ipcMain.handle(IPC.COVENANT_STATUS, async () => covenantInvoke(() => covenantStatus()))

  ipcMain.handle(IPC.COVENANT_SIGN_IN, async () => {
    const token = await resolveGithubToken(readConfig())
    if (!token) return { ok: false as const, error: 'no-github-token' }
    return covenantInvoke(async () => {
      await covenantExchange(token)
      return covenantStatus()
    })
  })

  ipcMain.handle(IPC.COVENANT_SIGN_OUT, async () =>
    covenantInvoke(() => {
      covenantSignOut()
      return covenantStatus()
    }),
  )

  ipcMain.handle(IPC.COVENANT_ORGS_LIST, async () => covenantInvoke(() => covenantListOrgs()))

  ipcMain.handle(IPC.COVENANT_ORG_CREATE, async (_e, slug: unknown, name: unknown) =>
    covenantInvoke(() => covenantCreateOrg(String(slug ?? ''), String(name ?? ''))),
  )

  ipcMain.handle(IPC.COVENANT_MEMBERS_LIST, async (_e, slug: unknown) =>
    covenantInvoke(() => covenantListMembers(String(slug ?? ''))),
  )

  ipcMain.handle(IPC.COVENANT_MEMBER_LOGINS_LIST, async (_e, slug: unknown) =>
    covenantInvoke(() => covenantListMemberLogins(String(slug ?? ''))),
  )

  ipcMain.handle(IPC.COVENANT_MEMBER_ADD, async (_e, slug: unknown, login: unknown) =>
    covenantInvoke(async () => {
      await covenantAddMember(String(slug ?? ''), String(login ?? ''))
      return null
    }),
  )

  ipcMain.handle(IPC.COVENANT_MEMBER_REMOVE, async (_e, slug: unknown, login: unknown) =>
    covenantInvoke(async () => {
      await covenantRemoveMember(String(slug ?? ''), String(login ?? ''))
      return null
    }),
  )

  ipcMain.handle(IPC.COVENANT_DEFAULTS_LIST, async (_e, slug: unknown) =>
    covenantInvoke(() => covenantListDefaults(String(slug ?? ''))),
  )

  ipcMain.handle(IPC.COVENANT_DEFAULT_SET, async (_e, slug: unknown, kind: unknown, name: unknown) =>
    covenantInvoke(async () => {
      await covenantSetDefault(String(slug ?? ''), String(kind ?? ''), String(name ?? ''))
      return null
    }),
  )

  ipcMain.handle(IPC.COVENANT_DEFAULT_UNSET, async (_e, slug: unknown, kind: unknown, name: unknown) =>
    covenantInvoke(async () => {
      await covenantUnsetDefault(String(slug ?? ''), String(kind ?? ''), String(name ?? ''))
      return null
    }),
  )

  ipcMain.handle(IPC.COVENANT_WORKSPACES_LIST, async (_e, slug: unknown) =>
    covenantInvoke(() => covenantListWorkspaces(String(slug ?? ''))),
  )

  ipcMain.handle(IPC.COVENANT_WORKSPACE_CREATE, async (_e, slug: unknown, name: unknown) =>
    covenantInvoke(() => covenantCreateWorkspace(String(slug ?? ''), String(name ?? ''))),
  )

  ipcMain.handle(
    IPC.COVENANT_WORKSPACE_RENAME,
    async (_e, slug: unknown, workspaceId: unknown, name: unknown) =>
      covenantInvoke(() =>
        covenantRenameWorkspace(String(slug ?? ''), String(workspaceId ?? ''), String(name ?? '')),
      ),
  )

  ipcMain.handle(IPC.COVENANT_WORKSPACE_DELETE, async (_e, slug: unknown, workspaceId: unknown) =>
    covenantInvoke(async () => {
      await covenantDeleteWorkspace(String(slug ?? ''), String(workspaceId ?? ''))
      return null
    }),
  )

  ipcMain.handle(
    IPC.COVENANT_WORKSPACE_ASSIGNEE_ADD,
    async (_e, slug: unknown, workspaceId: unknown, login: unknown) =>
      covenantInvoke(async () => {
        await covenantAddAssignee(String(slug ?? ''), String(workspaceId ?? ''), String(login ?? ''))
        return null
      }),
  )

  ipcMain.handle(
    IPC.COVENANT_WORKSPACE_ASSIGNEE_REMOVE,
    async (_e, slug: unknown, workspaceId: unknown, login: unknown) =>
      covenantInvoke(async () => {
        await covenantRemoveAssignee(
          String(slug ?? ''),
          String(workspaceId ?? ''),
          String(login ?? ''),
        )
        return null
      }),
  )

  ipcMain.handle(
    IPC.COVENANT_WORKSPACE_ADMIN_ADD,
    async (_e, slug: unknown, workspaceId: unknown, login: unknown) =>
      covenantInvoke(async () => {
        await covenantAddWorkspaceAdmin(
          String(slug ?? ''),
          String(workspaceId ?? ''),
          String(login ?? ''),
        )
        return null
      }),
  )

  ipcMain.handle(
    IPC.COVENANT_WORKSPACE_ADMIN_REMOVE,
    async (_e, slug: unknown, workspaceId: unknown, login: unknown) =>
      covenantInvoke(async () => {
        await covenantRemoveWorkspaceAdmin(
          String(slug ?? ''),
          String(workspaceId ?? ''),
          String(login ?? ''),
        )
        return null
      }),
  )

  ipcMain.handle(
    IPC.COVENANT_WORKSPACE_AGENTS_LIST,
    async (_e, slug: unknown, workspaceId: unknown) =>
      covenantInvoke(() =>
        covenantListWorkspaceAgents(String(slug ?? ''), String(workspaceId ?? '')),
      ),
  )

  ipcMain.handle(
    IPC.COVENANT_WORKSPACE_AGENT_UPSERT,
    async (_e, slug: unknown, workspaceId: unknown, agentId: unknown, definition: unknown) =>
      covenantInvoke(() =>
        covenantUpsertWorkspaceAgent(
          String(slug ?? ''),
          String(workspaceId ?? ''),
          String(agentId ?? ''),
          definition as Parameters<typeof covenantUpsertWorkspaceAgent>[3],
        ),
      ),
  )

  ipcMain.handle(
    IPC.COVENANT_WORKSPACE_AGENT_DELETE,
    async (_e, slug: unknown, workspaceId: unknown, agentId: unknown) =>
      covenantInvoke(async () => {
        await covenantDeleteWorkspaceAgent(
          String(slug ?? ''),
          String(workspaceId ?? ''),
          String(agentId ?? ''),
        )
        return null
      }),
  )

  ipcMain.handle(
    IPC.COVENANT_WORKSPACE_CONTEXTS_LIST,
    async (_e, slug: unknown, workspaceId: unknown) =>
      covenantInvoke(() =>
        covenantListWorkspaceContexts(String(slug ?? ''), String(workspaceId ?? '')),
      ),
  )

  ipcMain.handle(
    IPC.COVENANT_WORKSPACE_CONTEXT_UPSERT,
    async (_e, slug: unknown, workspaceId: unknown, contextId: unknown, payload: unknown) =>
      covenantInvoke(() =>
        covenantUpsertWorkspaceContext(
          String(slug ?? ''),
          String(workspaceId ?? ''),
          String(contextId ?? ''),
          payload as Parameters<typeof covenantUpsertWorkspaceContext>[3],
        ),
      ),
  )

  ipcMain.handle(
    IPC.COVENANT_WORKSPACE_CONTEXT_RENAME,
    async (
      _e,
      slug: unknown,
      workspaceId: unknown,
      previousId: unknown,
      nextId: unknown,
      payload: unknown,
    ) =>
      covenantInvoke(() =>
        covenantRenameWorkspaceContext(
          String(slug ?? ''),
          String(workspaceId ?? ''),
          String(previousId ?? ''),
          String(nextId ?? ''),
          payload as Parameters<typeof covenantRenameWorkspaceContext>[4],
        ),
      ),
  )

  ipcMain.handle(
    IPC.COVENANT_WORKSPACE_CONTEXT_DELETE,
    async (_e, slug: unknown, workspaceId: unknown, contextId: unknown) =>
      covenantInvoke(async () => {
        await covenantDeleteWorkspaceContext(
          String(slug ?? ''),
          String(workspaceId ?? ''),
          String(contextId ?? ''),
        )
        return null
      }),
  )

  ipcMain.handle(
    IPC.COVENANT_WORKSPACE_REPOS_LIST,
    async (_e, slug: unknown, workspaceId: unknown) =>
      covenantInvoke(() =>
        covenantListWorkspaceRepos(String(slug ?? ''), String(workspaceId ?? '')),
      ),
  )

  ipcMain.handle(
    IPC.COVENANT_WORKSPACE_REPO_ADD,
    async (_e, slug: unknown, workspaceId: unknown, payload: unknown) =>
      covenantInvoke(() =>
        covenantAddWorkspaceRepo(
          String(slug ?? ''),
          String(workspaceId ?? ''),
          payload as Parameters<typeof covenantAddWorkspaceRepo>[2],
        ),
      ),
  )

  ipcMain.handle(
    IPC.COVENANT_WORKSPACE_REPO_DELETE,
    async (_e, slug: unknown, workspaceId: unknown, repoId: unknown) =>
      covenantInvoke(async () => {
        await covenantDeleteWorkspaceRepo(
          String(slug ?? ''),
          String(workspaceId ?? ''),
          String(repoId ?? ''),
        )
        return null
      }),
  )

  ipcMain.handle(
    IPC.COVENANT_WORKSPACE_CLONE,
    async (_e, params: unknown): Promise<OrgWorkspaceCloneResult> => {
      const p = (params && typeof params === 'object' ? params : {}) as {
        orgSlug?: unknown
        workspaceSlug?: unknown
        repos?: unknown
        workspaceDir?: unknown
      }
      const config = readConfig()
      const workspaceDir =
        typeof p.workspaceDir === 'string' ? p.workspaceDir.trim() : ''
      const baseDir = config.defaultWorkspacesDir?.trim() ?? ''
      if (!workspaceDir && !baseDir) return { ok: false, error: 'missing-default-dir' }
      const token = await resolveGithubToken(config)
      if (!token) return { ok: false, error: 'missing-token' }
      const reposRaw = Array.isArray(p.repos) ? p.repos : []
      const repos: OrgWorkspaceCloneRepo[] = reposRaw.map((item: unknown) => {
        const r = (item && typeof item === 'object' ? item : {}) as {
          repoFullName?: unknown
          cloneUrl?: unknown
        }
        return {
          repoFullName: String(r.repoFullName ?? ''),
          cloneUrl: String(r.cloneUrl ?? ''),
        }
      })
      return cloneOrgWorkspace({
        baseDir: baseDir || workspaceDir,
        orgSlug: String(p.orgSlug ?? ''),
        workspaceSlug: String(p.workspaceSlug ?? ''),
        repos,
        token,
        ...(workspaceDir ? { workspaceDir } : {}),
      })
    },
  )

  ipcMain.handle(IPC.COVENANT_ORG_ADMINS_LIST, async (_e, slug: unknown) =>
    covenantInvoke(() => covenantListOrgAdmins(String(slug ?? ''))),
  )

  ipcMain.handle(IPC.COVENANT_ORG_ADMIN_ADD, async (_e, slug: unknown, login: unknown) =>
    covenantInvoke(async () => {
      await covenantAddOrgAdmin(String(slug ?? ''), String(login ?? ''))
      return null
    }),
  )

  ipcMain.handle(IPC.COVENANT_ORG_ADMIN_REMOVE, async (_e, slug: unknown, login: unknown) =>
    covenantInvoke(async () => {
      await covenantRemoveOrgAdmin(String(slug ?? ''), String(login ?? ''))
      return null
    }),
  )

  ipcMain.handle(IPC.GITHUB_CHECK_TOKEN, async (_e, raw: unknown): Promise<GitHubTokenCheck> => {
    const typed = typeof raw === 'string' ? raw.trim() : ''
    // Sin token escrito se comprueba el efectivo (entorno o credential helper).
    const token = typed || (await resolveGithubToken(readConfig()))
    if (!token) return { ok: false, error: 'missing' }
    try {
      const { login, scopes } = await fetchGitHubIdentity(token)
      return { ok: true, login, scopes }
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : String(error) }
    }
  })

  ipcMain.handle(IPC.FILE_EXPLORER_SET_ROOT, (_e, sessionId: string, rootPath: unknown) => {
    const root = typeof rootPath === 'string' ? rootPath.trim() : ''
    if (root) {
      const resolvedRoot = resolve(root)
      explorerRootBySession.set(sessionId, resolvedRoot)
      // Sesiones sintéticas (sin PTY): anclar cwd para getSessionCwd/git.
      if (!ptySessions.has(sessionId)) {
        initSessionCwd(sessionId, resolvedRoot)
      }
    } else {
      explorerRootBySession.delete(sessionId)
    }
  })

  ipcMain.handle(
    IPC.FILE_EXPLORER_LIST_DIR,
    async (_e, sessionId: string, relPath: unknown, showHiddenDirs: unknown) => {
      const rp = typeof relPath === 'string' ? relPath : ''
      const showHidden = showHiddenDirs !== false
      return listDirChildren(explorerRootForSession(sessionId), rp, showHidden, {
        prefetchDepth: 1,
      })
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
      return loadFileForExplorer(explorerRootForSession(sessionId), relPath, opts)
    },
  )

  ipcMain.handle(
    IPC.FILE_EXPLORER_LOAD_BYTES,
    (_e, sessionId: string, relPath: unknown, maxBytes: unknown) => {
      if (typeof relPath !== 'string' || !relPath.trim()) {
        return { ok: false, relPath: '', error: 'ruta vacía' }
      }
      // El tope lo fija el renderer según el visor, pero se acota acá: el main
      // no acepta que le pidan cargar un archivo arbitrariamente grande.
      const cap = typeof maxBytes === 'number' && Number.isFinite(maxBytes)
        ? Math.min(Math.max(0, maxBytes), FILE_EXPLORER_MAX_PREVIEW_BYTES)
        : FILE_EXPLORER_MAX_PREVIEW_BYTES
      return loadFileBytesForExplorer(explorerRootForSession(sessionId), relPath, cap)
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
      return saveFileForExplorer(explorerRootForSession(sessionId), relPath, content)
    },
  )

  ipcMain.handle(IPC.FILE_EXPLORER_CREATE_DIR, (_e, sessionId: string, relPath: unknown) => {
    if (typeof relPath !== 'string' || !relPath.trim()) {
      return { ok: false, error: 'ruta vacía' }
    }
    return createDirForExplorer(explorerRootForSession(sessionId), relPath)
  })

  ipcMain.handle(IPC.FILE_EXPLORER_CREATE_FILE, (_e, sessionId: string, relPath: unknown) => {
    if (typeof relPath !== 'string' || !relPath.trim()) {
      return { ok: false, error: 'ruta vacía' }
    }
    return createFileForExplorer(explorerRootForSession(sessionId), relPath)
  })

  ipcMain.handle(IPC.FILE_EXPLORER_COPY, (_e, sessionId: string, relPaths: unknown) => {
    if (!Array.isArray(relPaths)) {
      return { ok: false, error: 'rutas inválidas' }
    }
    const paths = relPaths.filter((p): p is string => typeof p === 'string' && p.trim().length > 0)
    return copyPathsForExplorer(sessionId, explorerRootForSession(sessionId), paths)
  })

  ipcMain.handle(IPC.FILE_EXPLORER_PASTE, (_e, sessionId: string, destRelPath: unknown) => {
    const dest = typeof destRelPath === 'string' ? destRelPath : ''
    return pasteIntoExplorer(sessionId, explorerRootForSession(sessionId), dest)
  })

  ipcMain.handle(IPC.FILE_EXPLORER_DELETE, (_e, sessionId: string, relPath: unknown) => {
    if (typeof relPath !== 'string' || !relPath.trim()) {
      return { ok: false, error: 'ruta vacía' }
    }
    return deletePathForExplorer(explorerRootForSession(sessionId), relPath)
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
        explorerRootForSession(sessionId),
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
    return cutPathsForExplorer(sessionId, explorerRootForSession(sessionId), paths)
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
        explorerRootForSession(sessionId),
        oldRelPath,
        newRelPath,
      )
    },
  )

  ipcMain.handle(IPC.FILE_EXPLORER_SEARCH, (_e, sessionId: string, query: unknown) => {
    return searchProjectFiles(explorerRootForSession(sessionId), query)
  })

  ipcMain.handle(IPC.FILE_EXPLORER_REVEAL, (_e, sessionId: string, relPath: unknown) => {
    if (typeof relPath !== 'string' || !relPath.trim()) {
      return { ok: false, error: 'ruta vacía' }
    }
    const result = revealPathForExplorer(explorerRootForSession(sessionId), relPath)
    if (result.ok) {
      shell.showItemInFolder(result.absPath)
    }
    return result
  })

  ipcMain.on(IPC.FILE_EXPLORER_WATCH_START, (_e, sessionId: string) => {
    const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0] ?? null
    startFileExplorerWatch(sessionId, explorerRootForSession(sessionId), win)
  })

  ipcMain.on(IPC.FILE_EXPLORER_WATCH_STOP, (_e, sessionId: string) => {
    stopFileExplorerWatch(sessionId)
  })

  ipcMain.handle(IPC.SESSION_LOAD, (): PersistedSession | null => loadSession())

  ipcMain.handle(IPC.SESSION_SAVE, (_e, data: PersistedSession) => {
    saveSession(data)
  })

  ipcMain.handle(IPC.PROJECT_AGENTS_LIST, (_e, cwd: unknown) => {
    return listProjectAgents(typeof cwd === 'string' ? cwd : '')
  })

  ipcMain.handle(IPC.PROJECT_AGENTS_UPSERT, (_e, cwd: unknown, definition: unknown) => {
    return upsertProjectAgent(
      typeof cwd === 'string' ? cwd : '',
      definition as ProjectAgentDefinition,
    )
  })

  ipcMain.handle(
    IPC.PROJECT_AGENTS_RENAME,
    (_e, cwd: unknown, fromId: unknown, definition: unknown) => {
      return renameProjectAgent(
        typeof cwd === 'string' ? cwd : '',
        typeof fromId === 'string' ? fromId : '',
        definition as ProjectAgentDefinition,
      )
    },
  )

  ipcMain.handle(IPC.PROJECT_AGENTS_DELETE, (_e, cwd: unknown, agentId: unknown) => {
    return deleteProjectAgent(
      typeof cwd === 'string' ? cwd : '',
      typeof agentId === 'string' ? agentId : '',
    )
  })

  ipcMain.handle(IPC.BRAINSTORM_LIST, (_e, cwd: unknown) => {
    return listBrainstormRooms(typeof cwd === 'string' ? cwd : '')
  })

  ipcMain.handle(IPC.BRAINSTORM_UPSERT, (_e, cwd: unknown, room: unknown) => {
    return upsertBrainstormRoom(
      typeof cwd === 'string' ? cwd : '',
      room as BrainstormRoom,
    )
  })

  ipcMain.handle(IPC.BRAINSTORM_DELETE, (_e, cwd: unknown, roomId: unknown) => {
    return deleteBrainstormRoom(
      typeof cwd === 'string' ? cwd : '',
      typeof roomId === 'string' ? roomId : '',
    )
  })

  ipcMain.handle(IPC.BRAINSTORM_PRUNE, (_e, cwd: unknown, maxAgeDays: unknown) => {
    return pruneBrainstormRooms(
      typeof cwd === 'string' ? cwd : '',
      typeof maxAgeDays === 'number' ? maxAgeDays : undefined,
    )
  })

  ipcMain.handle(IPC.BRAINSTORM_EXPORT_MD, (_e, cwd: unknown, roomId: unknown) => {
    return exportBrainstormRoomMarkdown(
      typeof cwd === 'string' ? cwd : '',
      typeof roomId === 'string' ? roomId : '',
    )
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
    if (!isAgentCliProvider(provider) || typeof cliSessionId !== 'string') return
    clearAgentContextDeliveryForSession(provider, cliSessionId)
  })
  ipcMain.handle(IPC.CONTEXT_METRICS_GET, () => getContextDeliveryMetrics())
  ipcMain.handle(IPC.AGENT_MCP_SERVERS_LIST, (_event, request: McpServersListRequest) => {
    const empty = { servers: [], file: '.mcp.json', fileExists: false, unreadProjectServers: [] }
    if (!request || !isAgentCliProvider(request.provider)) return empty
    const { provider } = request
    const cwd = request.cwd ?? ''
    const home = app.getPath('home')
    const servers = mcpServerSummaries(readMcpConfigFor(provider, cwd, home))
    // Si el CLI no lee el `.mcp.json` del proyecto, los que haya ahí le son
    // invisibles: el panel necesita poder nombrarlos para explicar por qué.
    const unreadProjectServers = providerUsesProjectMcpConfig(provider) || !cwd
      ? []
      : mcpServerNames(readProjectMcpConfig(cwd))
    return {
      servers,
      file: mcpConfigLabelFor(provider),
      fileExists: existsSync(mcpConfigPathFor(provider, cwd, home)),
      unreadProjectServers,
    }
  })
  /**
   * Abre el archivo de config MCP del CLI en el Finder. Con `create`, lo crea
   * antes con un `mcpServers` vacío: sin eso, el panel te manda a un archivo que
   * no existe y ahí se termina la ayuda. La ruta la resuelve el main —el
   * renderer solo manda el provider— y nunca se pisa uno existente.
   */
  ipcMain.handle(IPC.AGENT_MCP_CONFIG_REVEAL, (
    _event,
    request: { provider?: unknown; cwd?: unknown; create?: unknown },
  ) => {
    if (!request || !isAgentCliProvider(request.provider)) {
      return { ok: false, error: 'proveedor inválido' }
    }
    const cwd = typeof request.cwd === 'string' ? request.cwd : ''
    const path = mcpConfigPathFor(request.provider, cwd, app.getPath('home'))
    try {
      const { created } = request.create === true
        ? ensureMcpConfigFile(path)
        : { created: false }
      if (!existsSync(path)) return { ok: false, error: 'el archivo no existe' }
      shell.showItemInFolder(path)
      return { ok: true, created }
    } catch (error) {
      return { ok: false, error: (error as Error).message }
    }
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
      previousFileName: request.previousFileName,
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
    const result = discoverTabContexts(request.cwd)
    if (result.contextsMigrated) {
      clearAgentContextDeliveryState()
    }
    return result
  })
  ipcMain.handle(IPC.AGENT_RESULTS_ENSURE, (_event, request: unknown) => {
    if (!request || typeof request !== 'object') {
      return { ok: false, error: 'Solicitud inválida.' }
    }
    const cwd = (request as { cwd?: unknown }).cwd
    const agentId = (request as { agentId?: unknown }).agentId
    const agentName = (request as { agentName?: unknown }).agentName
    if (typeof cwd !== 'string' || !cwd.trim() || typeof agentId !== 'string' || !agentId.trim()) {
      return { ok: false, error: 'Solicitud inválida.' }
    }
    try {
      const filePath = ensureAiAgentResults(
        cwd,
        agentId,
        typeof agentName === 'string' ? agentName : undefined,
      )
      if (!filePath) return { ok: false, error: 'Id de agente vacío.' }
      return { ok: true, filePath }
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  })
  ipcMain.handle(IPC.AGENT_RESULTS_SET_NOTES, (_event, request: unknown) => {
    const cwd = (request as { cwd?: unknown } | null)?.cwd
    const agentId = (request as { agentId?: unknown } | null)?.agentId
    const notes = (request as { notes?: unknown } | null)?.notes
    if (typeof cwd !== 'string' || !cwd.trim() || typeof agentId !== 'string' || !agentId.trim()
      || typeof notes !== 'string') {
      return { ok: false, error: 'Solicitud inválida.' }
    }
    return writeAiAgentResultsNotes(cwd, agentId, notes)
  })
  ipcMain.handle(IPC.TAB_CONTEXT_DELETE, (_event, request: TabContextDeleteRequest) => {
    if (!request || typeof request.cwd !== 'string' || !request.context) {
      return { ok: false, error: 'Solicitud inválida.' }
    }
    return deleteTabContext(request.context, request.cwd)
  })
  ipcMain.handle(IPC.TAB_CONTEXT_REVEAL, (_e, cwd: unknown, fileName: unknown) => {
    if (typeof cwd !== 'string' || typeof fileName !== 'string') {
      return { ok: false, error: 'solicitud inválida' }
    }
    const result = resolveTabContextRevealPath(cwd, fileName)
    if (!result.ok) return result
    shell.showItemInFolder(result.absPath)
    return { ok: true }
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
    if (!isAgentCliProvider(request.provider)) {
      reject(request.paneId, 'Proveedor de agente no válido.')
      return
    }
    if (!['auto', 'plan'].includes(request.permissionMode)) {
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
  ipcMain.handle(IPC.AGENT_CLI_LIST_MODELS, async (_event, provider: unknown): Promise<AgentCliModelsResult> => {
    if (!isAgentCliProvider(provider)) {
      return {
        models: [],
        source: 'fallback',
        error: 'Proveedor no válido.',
      }
    }
    return listAgentCliModels(provider, readConfig())
  })
  ipcMain.handle(
    IPC.AGENT_CLI_RESOLVE,
    async (_event, provider: unknown, command: unknown): Promise<AgentCliResolution | null> => {
      if (!isAgentCliProvider(provider)) return null
      return resolveAgentCli(
        provider,
        typeof command === 'string' ? command : undefined,
        readConfig(),
      )
    },
  )

  ipcMain.on(IPC.BRAINSTORM_START, (event, config: BrainstormStartConfig) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win || !config || typeof config !== 'object') return
    const result = startBrainstormRoom(
      win,
      config,
      readConfig(),
      app.getPath('home'),
    )
    if (!result.ok) {
      const roomId = typeof config.roomId === 'string' ? config.roomId.trim() : ''
      if (roomId) {
        win.webContents.send(IPC.BRAINSTORM_EVENT, roomId, {
          type: 'error',
          message: result.error,
        })
        win.webContents.send(IPC.BRAINSTORM_EVENT, roomId, {
          type: 'status',
          status: 'stopped',
        })
      }
    }
  })
  ipcMain.on(IPC.BRAINSTORM_STOP, (event, roomId: string) => {
    if (typeof roomId !== 'string') return
    const win = BrowserWindow.fromWebContents(event.sender)
    stopBrainstormRoom(roomId, win ? { win, notify: true } : {})
  })
  ipcMain.on(IPC.BRAINSTORM_PAUSE, (event, roomId: string) => {
    if (typeof roomId !== 'string') return
    const win = BrowserWindow.fromWebContents(event.sender)
    pauseBrainstormRoom(roomId, win ? { win, notify: true } : {})
  })
  ipcMain.on(IPC.BRAINSTORM_INJECT_HUMAN, (event, roomId: string, text: string) => {
    if (typeof roomId !== 'string') return
    const win = BrowserWindow.fromWebContents(event.sender)
    const result = injectBrainstormHumanMessage(roomId, text, win ? { win } : {})
    if (!result.ok && win) {
      win.webContents.send(IPC.BRAINSTORM_EVENT, roomId, {
        type: 'error',
        message: result.error,
      })
    }
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
    explorerRootBySession.delete(sessionId)
  })
}

/** Log de diagnóstico de crashes GPU/renderer en userData (timestamp + JSON). */
function appendCrashDiagnostics(label: string, details: unknown): void {
  console.error(`[crash-diagnostics] ${label}`, details)
  try {
    const line = `${new Date().toISOString()} ${label} ${JSON.stringify(details)}\n`
    appendFileSync(join(app.getPath('userData'), 'crash-diagnostics.log'), line, 'utf-8')
  } catch { /* ignore */ }
}

function createWindow(): BrowserWindow {
  const icon = resolveOptionalWindowIcon()
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 600,
    minHeight: 400,
    // Sin esto la ventana se pinta con `backgroundColor` (oscuro) antes de que el
    // splash tome los colores del tema: parpadeo negro en temas claros.
    show: false,
    ...(icon ? { icon } : {}),
    backgroundColor: '#0d0d14',
    ...(process.platform === 'darwin'
      ? {
          titleBarStyle: 'hiddenInset' as const,
          // ponytail: 9 medido, no calculado — macOS aplica un offset propio sobre esta `y`,
          // así que no sale de (36 − 12) / 2. Si cambia --titlebar-height, medir de nuevo.
          trafficLightPosition: { x: 14, y: 9 },
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
      // El visor de PDF integrado de Chromium es un "plugin" interno: sin esto
      // un iframe apuntando a un blob application/pdf no pinta nada.
      plugins: true,
    },
  })

  // Red de seguridad: si `ready-to-show` no llega (carga fallida), mostrar igual;
  // una ventana invisible deja la app inusable.
  const showTimer = setTimeout(() => { if (!win.isDestroyed()) win.show() }, 4_000)
  win.once('ready-to-show', () => {
    clearTimeout(showTimer)
    win.show()
  })

  win.webContents.on('render-process-gone', (_e, details) => {
    appendCrashDiagnostics('render-process-gone', {
      windowId: win.id,
      reason: details.reason,
      exitCode: details.exitCode,
    })
  })

  // Mic/media: registerRendererMediaPermissions() en defaultSession (solo ventanas app).

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
  let quitConfirmed = false

  // El confirm de salida lo pinta el renderer (modal de la app). Si el renderer
  // está muerto no hay quien pregunte: en ese caso se cierra directo.
  const onQuitConfirmed = (e: Electron.IpcMainEvent): void => {
    if (win.isDestroyed() || e.sender !== win.webContents) return
    quitConfirmed = true
    win.close()
  }
  ipcMain.on(IPC.APP_QUIT_CONFIRMED, onQuitConfirmed)

  win.on('close', e => {
    if (closingFromReady) return
    e.preventDefault()

    // Confirmar sólo si hay terminales/agentes vivos; instalando update nadie pregunta.
    const askable = !win.webContents.isDestroyed() && !win.webContents.isCrashed()
    if (!quitConfirmed && askable && ptySessions.size > 0 && !isInstallingUpdate()) {
      win.webContents.send(IPC.APP_CONFIRM_QUIT)
      return
    }

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
    clearTimeout(showTimer)
    ipcMain.removeListener(IPC.APP_QUIT_CONFIRMED, onQuitConfirmed)
    const closedWinId = win.id
    stopAgentRunsForWindow(closedWinId)
    stopBrainstormRoomsForWindow(closedWinId)
    for (const [id, entry] of [...ptySessions.entries()]) {
      if (entry.windowId === closedWinId) {
        killPty(id)
        stopFileExplorerWatch(id)
      }
    }
    // Cerrar la última ventana = salir (también en macOS; no quedarse en el Dock).
    // Salvo instalando: ahí quien sale es Squirrel, tras copiar el .app nuevo.
    if (BrowserWindow.getAllWindows().length === 0 && !isInstallingUpdate()) {
      app.quit()
    }
  })

  return win
}

app.on('child-process-gone', (_e, details) => {
  appendCrashDiagnostics('child-process-gone', details)
  if (details.type !== 'GPU') return
  // El proceso GPU se relanza solo; invalidate fuerza recomposición para
  // recuperar ventanas que quedaron en negro tras el crash.
  setTimeout(() => {
    for (const win of BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed()) win.webContents.invalidate()
    }
  }, 1000)
})

/** Mic / Web Speech en el composer: solo ventanas propias de la app. */
function isAppRendererMediaPermission(
  webContents: Electron.WebContents | null | undefined,
  permission: string,
): boolean {
  if (permission !== 'media' && permission !== 'microphone') return false
  if (!webContents || webContents.isDestroyed()) return false
  return BrowserWindow.fromWebContents(webContents) != null
}

function registerRendererMediaPermissions(): void {
  const ses = session.defaultSession
  ses.setPermissionRequestHandler((webContents, permission, callback) => {
    if (permission === 'media' || permission === 'microphone') {
      callback(isAppRendererMediaPermission(webContents, permission))
      return
    }
    // Resto: criterio permisivo previo (sin handler global restrictivo).
    callback(true)
  })
  ses.setPermissionCheckHandler((webContents, permission) => {
    if (permission === 'media' || permission === 'microphone') {
      return isAppRendererMediaPermission(webContents, permission)
    }
    return true
  })
}

app.whenReady().then(() => {
  // Dock/Finder/Explorer no heredan el PATH del shell; sin esto spawn(CLI) → ENOENT/-4058.
  applyLoginShellPath()
  applyAppBranding()
  initCovenantSession()
  registerRendererMediaPermissions()
  // Los eventos LSP se emiten a TODAS las ventanas: el mux del preload filtra
  // por serverId, así que una ventana sin ese server simplemente los ignora.
  initLspEngine({
    dataDir: app.getPath('userData'),
    emit: (channel, ...args) => {
      for (const w of BrowserWindow.getAllWindows()) {
        if (!w.isDestroyed()) w.webContents.send(channel, ...args)
      }
    },
    channels: {
      message: IPC.LSP_MESSAGE,
      exit: IPC.LSP_EXIT,
      downloadProgress: IPC.LSP_DOWNLOAD_PROGRESS,
    },
  })
  registerIpc()
  registerSelfUpdate(readConfig().autoUpdatesEnabled)
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  // Instalando una actualización este handler corre ANTES que el de selfUpdate
  // (se registra al cargar el módulo, el otro al pulsar Instalar): salir aquí
  // mata el proceso antes del relevo a Squirrel y la actualización no se aplica.
  if (isInstallingUpdate()) return
  getDictationRuntime().dispose()
  // Incluye macOS: no dejar la app viva en el Dock tras cerrar la ventana.
  // Tras close+preventDefault+destroy hay que re-lanzar quit (⌘Q también).
  app.quit()
})
