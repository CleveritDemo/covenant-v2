import { contextBridge, ipcRenderer } from 'electron'
import { IPC } from '../src/shared/ipcChannels'
import type { AppConfig } from '../src/shared/configSchema'
import type { ProjectAiContextForAi } from '../src/shared/projectAiContext'
import type { PersistedSession, ChatEntry } from './persistence'
import type { SpotifyPlaybackState } from './spotifyNative'
import type { GitCommandResult, GitDiffForAiPayload, GitRepoStatus } from '../src/shared/gitSessionTypes'
import type { GitHubActionsSnapshot } from '../src/shared/githubActionsTypes'
import type {
  FileExplorerClipboardResult,
  FileExplorerFilePayload,
  FileExplorerListResult,
  FileExplorerSearchResult,
  FileExplorerWriteResult,
} from '../src/shared/fileExplorerTypes'
import type {
  AgentChatEntry,
  AgentCliStartRequest,
  AgentCliUiEvent,
} from '../src/shared/agentCliTypes'
import type {
  TabContextAnnotationRequest,
  TabContextDeleteRequest,
  TabContextDeleteResult,
  TabContextDiscoveryRequest,
  TabContextDiscoveryResult,
  TabContextPreviewRequest,
  TabContextPreviewResult,
} from '../src/shared/tabContext'

/** Un listener IPC por canal; evita MaxListenersExceeded con muchos paneles PTY. */
function createPtyChannelMux<TArgs extends unknown[]>(
  channel: string,
): (sessionId: string, cb: (...args: TArgs) => void) => () => void {
  const subsBySession = new Map<string, Set<(...args: TArgs) => void>>()
  let installed = false

  const ensureListener = (): void => {
    if (installed) return
    installed = true
    ipcRenderer.on(channel, (_e: Electron.IpcRendererEvent, sessionId: string, ...args: unknown[]) => {
      const subs = subsBySession.get(sessionId)
      if (!subs) return
      for (const cb of subs) cb(...(args as TArgs))
    })
  }

  return (sessionId: string, cb: (...args: TArgs) => void) => {
    ensureListener()
    let subs = subsBySession.get(sessionId)
    if (!subs) {
      subs = new Set()
      subsBySession.set(sessionId, subs)
    }
    subs.add(cb)
    return () => {
      subs!.delete(cb)
      if (subs!.size === 0) subsBySession.delete(sessionId)
    }
  }
}

const subscribePtyData = createPtyChannelMux<[data: string]>(IPC.PTY_DATA)
const subscribePtyExit = createPtyChannelMux<[code: number]>(IPC.PTY_EXIT)
const subscribePtyError = createPtyChannelMux<[message: string]>(IPC.PTY_ERROR)
const subscribeAgentCliEvent = createPtyChannelMux<[event: AgentCliUiEvent]>(IPC.AGENT_CLI_EVENT)
const subscribeAgentCliExit = createPtyChannelMux<[code: number]>(IPC.AGENT_CLI_EXIT)
const subscribeFileExplorerFsChanged = createPtyChannelMux<[dirs: string[]]>(IPC.FILE_EXPLORER_FS_CHANGED)
const subscribeGitStatusChanged = createPtyChannelMux<[]>(IPC.GIT_STATUS_CHANGED)

const api = {
  // ─── PTY ───────────────────────────────────────────────────────────────────
  ptyCreate(sessionId: string, cwd?: string): void {
    ipcRenderer.send(IPC.PTY_CREATE, sessionId, cwd)
  },
  ptyWrite(sessionId: string, data: string): void {
    ipcRenderer.send(IPC.PTY_WRITE, sessionId, data)
  },
  ptyResize(sessionId: string, cols: number, rows: number): void {
    ipcRenderer.send(IPC.PTY_RESIZE, sessionId, cols, rows)
  },
  ptyKill(sessionId: string): void {
    ipcRenderer.send(IPC.PTY_KILL, sessionId)
  },
  onPtyData(sessionId: string, cb: (data: string) => void): () => void {
    return subscribePtyData(sessionId, cb)
  },
  onPtyExit(sessionId: string, cb: (code: number) => void): () => void {
    return subscribePtyExit(sessionId, cb)
  },
  onPtyError(sessionId: string, cb: (message: string) => void): () => void {
    return subscribePtyError(sessionId, cb)
  },

  startAgentTurn(request: AgentCliStartRequest): void {
    ipcRenderer.send(IPC.AGENT_CLI_START, request)
  },
  stopAgentTurn(paneId: string): void {
    ipcRenderer.send(IPC.AGENT_CLI_STOP, paneId)
  },
  isAgentTurnActive(paneId: string): Promise<boolean> {
    return ipcRenderer.invoke(IPC.AGENT_CLI_IS_ACTIVE, paneId)
  },
  onAgentCliEvent(paneId: string, cb: (event: AgentCliUiEvent) => void): () => void {
    return subscribeAgentCliEvent(paneId, cb)
  },
  onAgentCliExit(paneId: string, cb: (code: number) => void): () => void {
    return subscribeAgentCliExit(paneId, cb)
  },
  loadAgentChat(paneId: string): Promise<AgentChatEntry[]> {
    return ipcRenderer.invoke(IPC.AGENT_CHAT_LOAD, paneId)
  },
  saveAgentChat(paneId: string, entries: AgentChatEntry[]): void {
    ipcRenderer.send(IPC.AGENT_CHAT_SAVE, paneId, entries)
  },
  deleteAgentChat(paneId: string): void {
    ipcRenderer.send(IPC.AGENT_CHAT_DELETE, paneId)
  },
  clearAgentContextDelivery(payload: {
    provider: 'claude' | 'cursor'
    cliSessionId: string
  }): void {
    ipcRenderer.send(IPC.AGENT_CONTEXT_DELIVERY_CLEAR, payload)
  },
  previewTabContext(request: TabContextPreviewRequest): Promise<TabContextPreviewResult> {
    return ipcRenderer.invoke(IPC.TAB_CONTEXT_PREVIEW, request)
  },
  materializeTabContext(request: TabContextPreviewRequest): Promise<TabContextPreviewResult> {
    return ipcRenderer.invoke(IPC.TAB_CONTEXT_MATERIALIZE, request)
  },
  mergeTabContextAnnotations(request: TabContextAnnotationRequest): Promise<TabContextPreviewResult> {
    return ipcRenderer.invoke(IPC.TAB_CONTEXT_MERGE_ANNOTATIONS, request)
  },
  discoverTabContexts(request: TabContextDiscoveryRequest): Promise<TabContextDiscoveryResult> {
    return ipcRenderer.invoke(IPC.TAB_CONTEXT_DISCOVER, request)
  },
  deleteTabContext(request: TabContextDeleteRequest): Promise<TabContextDeleteResult> {
    return ipcRenderer.invoke(IPC.TAB_CONTEXT_DELETE, request)
  },

  onShortcutCloseTab(cb: () => void): () => void {
    const listener = (): void => {
      cb()
    }
    ipcRenderer.on(IPC.SHORTCUT_CLOSE_TAB, listener)
    return () => ipcRenderer.removeListener(IPC.SHORTCUT_CLOSE_TAB, listener)
  },

  // ─── Config ────────────────────────────────────────────────────────────────
  getConfig(): Promise<AppConfig> {
    return ipcRenderer.invoke(IPC.CONFIG_GET)
  },
  setConfig(partial: Partial<AppConfig>): Promise<{ ok: boolean; errors?: string[] }> {
    return ipcRenderer.invoke(IPC.CONFIG_SET, partial)
  },
  openConfigFolder(): void {
    ipcRenderer.send(IPC.CONFIG_OPEN_FOLDER)
  },

  getCdRecentList(): Promise<string[]> {
    return ipcRenderer.invoke(IPC.CD_RECENT_LIST)
  },

  recordCdLine(sessionId: string, line: string): Promise<string | null> {
    return ipcRenderer.invoke(IPC.CD_RECENT_RECORD_LINE, sessionId, line)
  },

  getSessionCwd(sessionId: string): Promise<string> {
    return ipcRenderer.invoke(IPC.GET_SESSION_CWD, sessionId)
  },

  listCwdDirs(sessionId: string): Promise<string[]> {
    return ipcRenderer.invoke(IPC.LIST_CWD_DIRS, sessionId)
  },

  openFolder(folderPath: string): void {
    ipcRenderer.send(IPC.OPEN_FOLDER, folderPath)
  },

  selectDirectory(options?: {
    title?: string
    defaultPath?: string
    /** Si se indica, la carpeta elegida debe estar dentro y se devuelve relativePath. */
    withinPath?: string
  }): Promise<
    | { ok: true; path: string; relativePath?: string }
    | { ok: false; cancelled?: boolean; error?: string }
  > {
    return ipcRenderer.invoke(IPC.SELECT_DIRECTORY, options)
  },

  openExternalUrl(url: string): Promise<{ ok: true } | { ok: false; error: string }> {
    return ipcRenderer.invoke(IPC.OPEN_EXTERNAL_URL, url)
  },

  spotifyDesktopInstalled(): Promise<boolean> {
    return ipcRenderer.invoke(IPC.SPOTIFY_DESKTOP_INSTALLED)
  },

  spotifyPlayPlaylist(
    playlistId: string,
  ): Promise<{ ok: true } | { ok: false; error: string }> {
    return ipcRenderer.invoke(IPC.SPOTIFY_PLAY_PLAYLIST, playlistId)
  },

  spotifyPause(): Promise<{ ok: true } | { ok: false; error: string }> {
    return ipcRenderer.invoke(IPC.SPOTIFY_PAUSE)
  },

  spotifyPlay(): Promise<{ ok: true } | { ok: false; error: string }> {
    return ipcRenderer.invoke(IPC.SPOTIFY_PLAY)
  },

  spotifyGetState(): Promise<SpotifyPlaybackState> {
    return ipcRenderer.invoke(IPC.SPOTIFY_GET_STATE)
  },

  getProjectAiContext(sessionId: string): Promise<ProjectAiContextForAi | null> {
    return ipcRenderer.invoke(IPC.PROJECT_AI_CONTEXT_GET, sessionId)
  },

  readAgentMd(sessionId: string): Promise<string | null> {
    return ipcRenderer.invoke(IPC.AGENT_MD_READ, sessionId)
  },

  writeAgentMd(
    sessionId: string,
    content: string,
  ): Promise<{ ok: boolean; error?: string }> {
    return ipcRenderer.invoke(IPC.AGENT_MD_WRITE, sessionId, content)
  },

  getAgentFolderTree(sessionId: string): Promise<string> {
    return ipcRenderer.invoke(IPC.AGENT_MD_TREE, sessionId)
  },

  agentReadFile(
    sessionId: string,
    relPath: string,
    startLine?: number,
    endLine?: number,
  ): Promise<{ ok: boolean; content?: string; totalLines?: number; error?: string }> {
    return ipcRenderer.invoke(IPC.AGENT_FILE_READ, sessionId, relPath, startLine, endLine)
  },

  agentPatchFile(
    sessionId: string,
    relPath: string,
    hunks: Array<{ search: string; replace: string }>,
  ): Promise<{ ok: boolean; error?: string }> {
    return ipcRenderer.invoke(IPC.AGENT_FILE_PATCH, sessionId, relPath, hunks)
  },

  agentWriteFile(
    sessionId: string,
    relPath: string,
    content: string,
  ): Promise<{ ok: boolean; error?: string }> {
    return ipcRenderer.invoke(IPC.AGENT_FILE_WRITE, sessionId, relPath, content)
  },

  agentRunShell(
    sessionId: string,
    command: string,
    options?: { destructiveConfirmed?: boolean },
  ): Promise<
    | { ok: true; exitCode: number | null; stdout: string; stderr: string }
    | { ok: false; error: string }
  > {
    return ipcRenderer.invoke(IPC.AGENT_SHELL_RUN, sessionId, command, options)
  },

  gitStatus(sessionId: string): Promise<GitRepoStatus> {
    return ipcRenderer.invoke(IPC.GIT_STATUS, sessionId)
  },

  gitDiffForAi(sessionId: string): Promise<GitDiffForAiPayload> {
    return ipcRenderer.invoke(IPC.GIT_DIFF_FOR_AI, sessionId)
  },

  gitPull(sessionId: string): Promise<GitCommandResult> {
    return ipcRenderer.invoke(IPC.GIT_PULL, sessionId)
  },

  gitPush(sessionId: string): Promise<GitCommandResult> {
    return ipcRenderer.invoke(IPC.GIT_PUSH, sessionId)
  },

  gitCommit(sessionId: string, message: string): Promise<GitCommandResult> {
    return ipcRenderer.invoke(IPC.GIT_COMMIT, sessionId, message)
  },

  gitStageAll(sessionId: string): Promise<GitCommandResult> {
    return ipcRenderer.invoke(IPC.GIT_STAGE_ALL, sessionId)
  },

  gitStageFile(sessionId: string, relPath: string): Promise<GitCommandResult> {
    return ipcRenderer.invoke(IPC.GIT_STAGE_FILE, sessionId, relPath)
  },

  gitUnstageAll(sessionId: string): Promise<GitCommandResult> {
    return ipcRenderer.invoke(IPC.GIT_UNSTAGE_ALL, sessionId)
  },

  gitUnstageFile(sessionId: string, relPath: string): Promise<GitCommandResult> {
    return ipcRenderer.invoke(IPC.GIT_UNSTAGE_FILE, sessionId, relPath)
  },

  githubActionsList(sessionId: string): Promise<GitHubActionsSnapshot> {
    return ipcRenderer.invoke(IPC.GITHUB_ACTIONS_LIST, sessionId)
  },

  fileExplorerListDir(
    sessionId: string,
    relPath: string,
    showHiddenDirs = true,
  ): Promise<FileExplorerListResult> {
    return ipcRenderer.invoke(IPC.FILE_EXPLORER_LIST_DIR, sessionId, relPath, showHiddenDirs)
  },

  fileExplorerLoadFile(
    sessionId: string,
    relPath: string,
    options?: { allowLarge?: boolean },
  ): Promise<FileExplorerFilePayload> {
    return ipcRenderer.invoke(IPC.FILE_EXPLORER_LOAD_FILE, sessionId, relPath, options)
  },

  fileExplorerSaveFile(
    sessionId: string,
    relPath: string,
    content: string,
  ): Promise<FileExplorerWriteResult> {
    return ipcRenderer.invoke(IPC.FILE_EXPLORER_SAVE_FILE, sessionId, relPath, content)
  },

  fileExplorerCreateDir(sessionId: string, relPath: string): Promise<FileExplorerWriteResult> {
    return ipcRenderer.invoke(IPC.FILE_EXPLORER_CREATE_DIR, sessionId, relPath)
  },

  fileExplorerCreateFile(sessionId: string, relPath: string): Promise<FileExplorerWriteResult> {
    return ipcRenderer.invoke(IPC.FILE_EXPLORER_CREATE_FILE, sessionId, relPath)
  },

  fileExplorerCopy(sessionId: string, relPaths: string[]): Promise<FileExplorerClipboardResult> {
    return ipcRenderer.invoke(IPC.FILE_EXPLORER_COPY, sessionId, relPaths)
  },

  fileExplorerPaste(sessionId: string, destRelPath: string): Promise<FileExplorerClipboardResult> {
    return ipcRenderer.invoke(IPC.FILE_EXPLORER_PASTE, sessionId, destRelPath)
  },

  fileExplorerDelete(sessionId: string, relPath: string): Promise<FileExplorerWriteResult> {
    return ipcRenderer.invoke(IPC.FILE_EXPLORER_DELETE, sessionId, relPath)
  },

  fileExplorerRename(
    sessionId: string,
    oldRelPath: string,
    newRelPath: string,
  ): Promise<FileExplorerWriteResult> {
    return ipcRenderer.invoke(IPC.FILE_EXPLORER_RENAME, sessionId, oldRelPath, newRelPath)
  },

  fileExplorerCut(sessionId: string, relPaths: string[]): Promise<FileExplorerClipboardResult> {
    return ipcRenderer.invoke(IPC.FILE_EXPLORER_CUT, sessionId, relPaths)
  },

  fileExplorerMove(
    sessionId: string,
    oldRelPath: string,
    newRelPath: string,
  ): Promise<FileExplorerWriteResult> {
    return ipcRenderer.invoke(IPC.FILE_EXPLORER_MOVE, sessionId, oldRelPath, newRelPath)
  },

  fileExplorerReveal(sessionId: string, relPath: string): Promise<FileExplorerWriteResult> {
    return ipcRenderer.invoke(IPC.FILE_EXPLORER_REVEAL, sessionId, relPath)
  },

  fileExplorerSearch(sessionId: string, query: string): Promise<FileExplorerSearchResult> {
    return ipcRenderer.invoke(IPC.FILE_EXPLORER_SEARCH, sessionId, query)
  },

  fileExplorerWatchStart(sessionId: string): void {
    ipcRenderer.send(IPC.FILE_EXPLORER_WATCH_START, sessionId)
  },

  fileExplorerWatchStop(sessionId: string): void {
    ipcRenderer.send(IPC.FILE_EXPLORER_WATCH_STOP, sessionId)
  },

  onFileExplorerFsChanged(
    sessionId: string,
    cb: (dirs: string[]) => void,
  ): () => void {
    return subscribeFileExplorerFsChanged(sessionId, cb)
  },

  onGitStatusChanged(sessionId: string, cb: () => void): () => void {
    return subscribeGitStatusChanged(sessionId, cb)
  },

  // ─── Persistencia ────────────────────────────────────────────────────────
  loadSession(): Promise<PersistedSession | null> {
    return ipcRenderer.invoke(IPC.SESSION_LOAD)
  },
  saveSession(data: PersistedSession): Promise<void> {
    return ipcRenderer.invoke(IPC.SESSION_SAVE, data)
  },
  listProjectAgents(cwd: string): Promise<import('../src/shared/projectAgentCatalog').ProjectAgentDefinition[]> {
    return ipcRenderer.invoke(IPC.PROJECT_AGENTS_LIST, cwd)
  },
  upsertProjectAgent(
    cwd: string,
    definition: import('../src/shared/projectAgentCatalog').ProjectAgentDefinition,
  ): Promise<
    | { ok: true; agent: import('../src/shared/projectAgentCatalog').ProjectAgentDefinition }
    | { ok: false; error: string }
  > {
    return ipcRenderer.invoke(IPC.PROJECT_AGENTS_UPSERT, cwd, definition)
  },
  deleteProjectAgent(
    cwd: string,
    agentId: string,
  ): Promise<{ ok: true } | { ok: false; error: string }> {
    return ipcRenderer.invoke(IPC.PROJECT_AGENTS_DELETE, cwd, agentId)
  },
  loadAiChat(paneId: string): Promise<ChatEntry[]> {
    return ipcRenderer.invoke(IPC.AI_CHAT_LOAD, paneId)
  },
  saveAiChat(paneId: string, entries: ChatEntry[]): void {
    ipcRenderer.send(IPC.AI_CHAT_SAVE, paneId, entries)
  },
  deleteAiChat(paneId: string): void {
    ipcRenderer.send(IPC.AI_CHAT_DELETE, paneId)
  },
  loadCmdHistory(paneId: string): Promise<string[]> {
    return ipcRenderer.invoke(IPC.CMD_HISTORY_LOAD, paneId)
  },
  saveCmdHistory(paneId: string, lines: string[]): void {
    ipcRenderer.send(IPC.CMD_HISTORY_SAVE, paneId, lines)
  },
  deleteCmdHistory(paneId: string): void {
    ipcRenderer.send(IPC.CMD_HISTORY_DELETE, paneId)
  },
  loadScrollback(paneId: string): Promise<string | null> {
    return ipcRenderer.invoke(IPC.SCROLLBACK_LOAD, paneId)
  },
  saveScrollback(paneId: string, data: string): void {
    ipcRenderer.send(IPC.SCROLLBACK_SAVE, paneId, data)
  },
  deleteScrollback(paneId: string): void {
    ipcRenderer.send(IPC.SCROLLBACK_DELETE, paneId)
  },
  loadInteractionsLog(paneId: string): Promise<string[]> {
    return ipcRenderer.invoke(IPC.INTERACTIONS_LOG_LOAD, paneId)
  },
  saveInteractionsLog(paneId: string, entries: string[]): void {
    ipcRenderer.send(IPC.INTERACTIONS_LOG_SAVE, paneId, entries)
  },
  deleteInteractionsLog(paneId: string): void {
    ipcRenderer.send(IPC.INTERACTIONS_LOG_DELETE, paneId)
  },
  onSaveBeforeClose(cb: () => void): () => void {
    const listener = (): void => cb()
    ipcRenderer.on(IPC.APP_SAVE_BEFORE_CLOSE, listener)
    return () => ipcRenderer.removeListener(IPC.APP_SAVE_BEFORE_CLOSE, listener)
  },
  sendCloseReady(scrollbacks: Record<string, string>): void {
    ipcRenderer.send(IPC.APP_CLOSE_READY, scrollbacks)
  },
}

contextBridge.exposeInMainWorld('api', api)

export type API = typeof api
