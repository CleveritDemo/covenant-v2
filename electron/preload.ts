import { contextBridge, ipcRenderer } from 'electron'
import { IPC } from '../src/shared/ipcChannels'
import type { AppConfig } from '../src/shared/configSchema'
import type { OnboardingCliStatus } from '../src/shared/onboarding'
import type { ProjectAiContextForAi } from '../src/shared/projectAiContext'
import type { McpServersListRequest, McpServersListResult } from '../src/shared/mcpContext'
import type { PersistedSession, ChatEntry } from './persistence'
import type { PulseScope, PulseSnapshot } from '../src/shared/pulseEvents'
import type { JiraIssueRef } from '../src/shared/jiraIssue'
import type { GithubIssueRef } from '../src/shared/githubIssue'
import type { RendererErrorReport } from '../src/shared/rendererErrorReport'
import type { ProcessMemoryReading, RendererVitals } from '../src/shared/rendererVitals'
import type {
  LspDownloadProgress,
  LspFileReadResult,
  LspFileWriteResult,
  LspInstalledServer,
  LspServerStatus,
  LspStartResponse,
} from '../src/shared/lspTypes'
import type {
  GitCommandResult,
  GitDiffForAiPayload,
  GitListedRepo,
  GitRepoRemote,
  GitRepoStatus,
  GitTarget,
} from '../src/shared/gitSessionTypes'
import type {
  GitCurrentBranchResult,
  GitWorktreeAbortMergeResult,
  GitWorktreeAddRequest,
  GitWorktreeAddResult,
  GitWorktreeEntry,
  GitWorktreeMergeRequest,
  GitWorktreeMergeResult,
  GitWorktreeRemoveRequest,
  GitWorktreeRemoveResult,
} from '../src/shared/gitWorktree'
import type {
  GitHubActionsSnapshot,
  GitHubRunJobsResult,
  GitHubTokenCheck,
} from '../src/shared/githubActionsTypes'
import type { GithubTokenSource } from './githubToken'
import type { GithubAccount } from '../src/shared/githubAccounts'
import type { GithubRepoListResult } from '../src/shared/githubRepoPicker'
import type {
  CovenantDefault,
  CovenantMember,
  CovenantOrg,
  CovenantWikiLogEntryRecord,
  CovenantWikiPagePayload,
  CovenantWikiPageRecord,
  CovenantWorkspace,
  CovenantWorkspaceAgentRecord,
  CovenantWorkspaceContextPayload,
  CovenantWorkspaceContextRecord,
  CovenantWorkspaceRepoPayload,
  CovenantWorkspaceRepoRecord,
  CovenantWorkspaceRepoUpdatePayload,
  CovenantResult,
  CovenantStatus,
} from '../src/shared/covenantTypes'
import type { ProjectAgentDefinition } from '../src/shared/projectAgentCatalog'
import type {
  FileExplorerClipboardResult,
  FileExplorerBytesPayload,
  FileExplorerFilePayload,
  FileExplorerListResult,
  FileExplorerSearchResult,
  FileExplorerWriteResult,
} from '../src/shared/fileExplorerTypes'
import type {
  AgentChatEntry,
  AgentCliImageAttachment,
  AgentCliStartRequest,
  AgentCliUiEvent,
  ContextDeliveryMetrics,
} from '../src/shared/agentCliTypes'
import type { AgentChatRef } from '../src/shared/agentChatPersistence'
import type { BrainstormEvent } from '../src/shared/brainstormRoom'
import type { LoopChainEvent, LoopChainRunStateSnapshot, LoopChainTranscript } from '../src/shared/loopChainEvents'
import type { AgentCliModelsResult } from '../src/shared/agentCliModels'
import type { AgentCliProvider, AgentCliResolution } from '../src/shared/agentCliProviders'
import type {
  TabContextDeleteRequest,
  TabContextDeleteResult,
  TabContextDiscoveryRequest,
  TabContextDiscoveryResult,
  TabContextPreviewRequest,
  TabContextPreviewResult,
} from '../src/shared/tabContext'
import type { WikiGraphResult } from '../src/shared/wikiGraph'
import type { WikiCuratorConfig, WikiCuratorEvent } from '../src/shared/wikiCurator'
import type { WikiSweepEvent } from '../src/shared/wikiCuratorSweep'
import type { UpdateState } from '../src/shared/updateState'
import type { DictationPermissionResult } from '../src/shared/dictation'
import type {
  OrgWorkspaceCloneRepo,
  OrgWorkspaceCloneResult,
} from '../src/shared/orgWorkspaceClone'

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
const subscribeBrainstormEvent = createPtyChannelMux<[event: BrainstormEvent]>(IPC.BRAINSTORM_EVENT)
const subscribeLoopChainEvent = createPtyChannelMux<[event: LoopChainEvent]>(IPC.LOOP_CHAIN_EVENT)
const subscribeWikiCuratorEvent = createPtyChannelMux<[event: WikiCuratorEvent]>(IPC.WIKI_CURATOR_EVENT)
const subscribeWikiSweepEvent = createPtyChannelMux<[event: WikiSweepEvent]>(IPC.WIKI_SWEEP_EVENT)
const subscribeFileExplorerFsChanged = createPtyChannelMux<[dirs: string[]]>(IPC.FILE_EXPLORER_FS_CHANGED)
const subscribeGitStatusChanged = createPtyChannelMux<[]>(IPC.GIT_STATUS_CHANGED)
// Los tres canales LSP se multiplexan igual que los de PTY: el primer argumento
// es la clave (serverId como string, o el lenguaje en el de progreso).
const subscribeLspMessage = createPtyChannelMux<[message: string]>(IPC.LSP_MESSAGE)
const subscribeLspExit = createPtyChannelMux<[]>(IPC.LSP_EXIT)
const subscribeLspDownloadProgress =
  createPtyChannelMux<[progress: LspDownloadProgress]>(IPC.LSP_DOWNLOAD_PROGRESS)

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
  stopAgentTurn(runKey: string): void {
    ipcRenderer.send(IPC.AGENT_CLI_STOP, runKey)
  },
  /** Acepta paneId (todos los carriles) o runKey paneId::threadId (un carril). */
  isAgentTurnActive(runKey: string): Promise<boolean> {
    return ipcRenderer.invoke(IPC.AGENT_CLI_IS_ACTIVE, runKey)
  },
  listAgentCliModels(provider: AgentCliProvider): Promise<AgentCliModelsResult> {
    return ipcRenderer.invoke(IPC.AGENT_CLI_LIST_MODELS, provider)
  },
  /** `command` vacío = el configurado o el por defecto del proveedor. */
  resolveAgentCli(provider: AgentCliProvider, command?: string): Promise<AgentCliResolution | null> {
    return ipcRenderer.invoke(IPC.AGENT_CLI_RESOLVE, provider, command)
  },
  pickAgentCliBinary(options?: { title?: string; buttonLabel?: string }): Promise<{ path: string | null }> {
    return ipcRenderer.invoke(IPC.AGENT_CLI_PICK_BINARY, options)
  },
  detectOnboardingClis(): Promise<OnboardingCliStatus[]> {
    return ipcRenderer.invoke(IPC.ONBOARDING_DETECT_CLIS)
  },
  /** Acepta paneId (todos los carriles) o runKey paneId::threadId (un carril). */
  onAgentCliEvent(runKey: string, cb: (event: AgentCliUiEvent) => void): () => void {
    return subscribeAgentCliEvent(runKey, cb)
  },
  /** Acepta paneId (todos los carriles) o runKey paneId::threadId (un carril). */
  onAgentCliExit(runKey: string, cb: (code: number) => void): () => void {
    return subscribeAgentCliExit(runKey, cb)
  },
  startBrainstorm(config: {
    roomId: string
    topic: string
    participantAgentIds: string[]
    maxRounds: number
    cwd: string
    contextIds?: string[]
    filePaths?: string[]
    outcome?: string
    ceremony?: string
    resume?: boolean
    round?: number
    cursor?: number
    messages?: import('../src/shared/brainstormRoom').BrainstormMessage[]
  }): void {
    ipcRenderer.send(IPC.BRAINSTORM_START, config)
  },
  stopBrainstorm(roomId: string): void {
    ipcRenderer.send(IPC.BRAINSTORM_STOP, roomId)
  },
  pauseBrainstorm(roomId: string): void {
    ipcRenderer.send(IPC.BRAINSTORM_PAUSE, roomId)
  },
  addBrainstormWorkingSet(
    roomId: string,
    working: { contextIds?: string[]; filePaths?: string[]; cwd?: string },
  ): Promise<{ ok: true; contextIds: string[]; filePaths: string[] } | { ok: false; error: string }> {
    return ipcRenderer.invoke(IPC.BRAINSTORM_WORKING_SET_ADD, roomId, working)
  },
  injectBrainstormHumanMessage(roomId: string, text: string, targetAgentId?: string): void {
    ipcRenderer.send(IPC.BRAINSTORM_INJECT_HUMAN, roomId, text, targetAgentId)
  },
  onBrainstormEvent(roomId: string, cb: (event: BrainstormEvent) => void): () => void {
    return subscribeBrainstormEvent(roomId, cb)
  },
  startLoopChain(config: {
    chainId: string
    steps: Array<{ agentId: string; objective: string }>
    intervalMs: number
    cwd: string
    agents: import('../src/shared/projectAgentCatalog').ProjectAgentDefinition[]
    contexts?: import('../src/shared/tabContext').TabContext[]
  }): void {
    ipcRenderer.send(IPC.LOOP_CHAIN_START, config)
  },
  stopLoopChain(chainId: string): void {
    ipcRenderer.send(IPC.LOOP_CHAIN_STOP, chainId)
  },
  getLoopChainState(chainId: string): Promise<LoopChainRunStateSnapshot | null> {
    return ipcRenderer.invoke(IPC.LOOP_CHAIN_STATE, chainId)
  },
  getLoopChainTranscript(chainId: string): Promise<LoopChainTranscript | null> {
    return ipcRenderer.invoke(IPC.LOOP_CHAIN_TRANSCRIPT, chainId)
  },
  onLoopChainEvent(chainId: string, cb: (event: LoopChainEvent) => void): () => void {
    return subscribeLoopChainEvent(chainId, cb)
  },
  loadAgentChat(ref: AgentChatRef | string, threadId: string): Promise<AgentChatEntry[]> {
    return ipcRenderer.invoke(IPC.AGENT_CHAT_LOAD, ref, threadId)
  },
  saveAgentChat(ref: AgentChatRef | string, threadId: string, entries: AgentChatEntry[]): void {
    ipcRenderer.send(IPC.AGENT_CHAT_SAVE, ref, threadId, entries)
  },
  /** Sin `threadId` borra todas las conversaciones del agente (al cerrar el pane). */
  deleteAgentChat(ref: AgentChatRef | string, threadId?: string): void {
    ipcRenderer.send(IPC.AGENT_CHAT_DELETE, ref, threadId)
  },
  clearAgentContextDelivery(payload: {
    provider: AgentCliProvider
    cliSessionId: string
  }): void {
    ipcRenderer.send(IPC.AGENT_CONTEXT_DELIVERY_CLEAR, payload)
  },
  /** Contadores acumulados desde el arranque: catálogo, secciones y tokens. */
  getContextDeliveryMetrics(): Promise<ContextDeliveryMetrics> {
    return ipcRenderer.invoke(IPC.CONTEXT_METRICS_GET)
  },
  /** Texto crudo del archivo de config MCP del CLI (o vacío si aún no existe). */
  readMcpConfig(request: { provider: string; cwd: string }): Promise<
    { ok: true; path: string; exists: boolean; text: string } | { ok: false; error: string }
  > {
    return ipcRenderer.invoke(IPC.AGENT_MCP_CONFIG_READ, request)
  },
  /** Sobrescribe ese archivo solo si el JSON pasa la validación del main. */
  /** `expected`: texto leído al abrir; sin él se sobrescribe sin preguntar. */
  writeMcpConfig(request: {
    provider: string
    cwd: string
    text: string
    expected?: string
  }): Promise<
    { ok: true; path: string } | { ok: false; error: string }
  > {
    return ipcRenderer.invoke(IPC.AGENT_MCP_CONFIG_WRITE, request)
  },
  /** Revela el archivo de config MCP del CLI; `create` lo crea si falta. */
  revealMcpConfig(request: {
    provider: string
    cwd?: string
    create?: boolean
  }): Promise<{ ok: boolean; created?: boolean; error?: string }> {
    return ipcRenderer.invoke(IPC.AGENT_MCP_CONFIG_REVEAL, request)
  },
  /** Servidores MCP que ese CLI ve, para marcar la allowlist en vez de escribirla. */
  importProjectMcpServer(request: {
    provider: string
    cwd: string
    name: string
  }): Promise<{ ok: boolean; path?: string; added?: boolean; error?: string }> {
    return ipcRenderer.invoke(IPC.AGENT_MCP_IMPORT_PROJECT, request)
  },
  listMcpServers(request: McpServersListRequest): Promise<McpServersListResult> {
    return ipcRenderer.invoke(IPC.AGENT_MCP_SERVERS_LIST, request)
  },
  previewTabContext(request: TabContextPreviewRequest): Promise<TabContextPreviewResult> {
    return ipcRenderer.invoke(IPC.TAB_CONTEXT_PREVIEW, request)
  },
  materializeTabContext(request: TabContextPreviewRequest): Promise<TabContextPreviewResult> {
    return ipcRenderer.invoke(IPC.TAB_CONTEXT_MATERIALIZE, request)
  },
  discoverTabContexts(request: TabContextDiscoveryRequest): Promise<TabContextDiscoveryResult> {
    return ipcRenderer.invoke(IPC.TAB_CONTEXT_DISCOVER, request)
  },
  ensureAiAgentResults(request: {
    cwd: string
    agentId: string
    agentName?: string
  }): Promise<{ ok: true; filePath: string } | { ok: false; error: string }> {
    return ipcRenderer.invoke(IPC.AGENT_RESULTS_ENSURE, request)
  },
  setAiAgentResultsNotes(request: {
    cwd: string
    agentId: string
    notes: string
  }): Promise<{ ok: boolean; filePath?: string; error?: string }> {
    return ipcRenderer.invoke(IPC.AGENT_RESULTS_SET_NOTES, request)
  },
  readAgentResultsLatest(request: {
    cwd: string
    agentId: string
  }): Promise<
    | { ok: true; summary: string | null; changes: string[] }
    | { ok: false; error: string }
  > {
    return ipcRenderer.invoke(IPC.AGENT_RESULTS_READ_LATEST, request)
  },
  deleteTabContext(request: TabContextDeleteRequest): Promise<TabContextDeleteResult> {
    return ipcRenderer.invoke(IPC.TAB_CONTEXT_DELETE, request)
  },
  revealTabContext(cwd: string, fileName: string): Promise<{ ok: boolean; error?: string }> {
    return ipcRenderer.invoke(IPC.TAB_CONTEXT_REVEAL, cwd, fileName)
  },
  getWikiGraph(cwd: string): Promise<WikiGraphResult> {
    return ipcRenderer.invoke(IPC.WIKI_GRAPH, cwd)
  },
  ensureWiki(cwd: string): Promise<{ ok: boolean }> {
    return ipcRenderer.invoke(IPC.WIKI_ENSURE, cwd)
  },
  syncReplaceWikiPages(
    cwd: string,
    pages: Array<{ slug: string; title: string; type: string; body: string }>,
  ): Promise<{ ok: boolean; error?: string }> {
    return ipcRenderer.invoke(IPC.WIKI_SYNC_REPLACE, cwd, pages)
  },
  syncReplaceWikiLog(
    cwd: string,
    entries: Array<{ entry: string; createdBy?: string | null; createdAt?: number }>,
  ): Promise<{ ok: boolean; error?: string }> {
    return ipcRenderer.invoke(IPC.WIKI_SYNC_REPLACE_LOG, cwd, entries)
  },
  startWikiCuratorTurn(config: {
    cwd: string
    message: string
    cliSessionId?: string
    images?: AgentCliImageAttachment[]
  }): void {
    ipcRenderer.send(IPC.WIKI_CURATOR_START, config)
  },
  stopWikiCuratorTurn(cwd: string): void {
    ipcRenderer.send(IPC.WIKI_CURATOR_STOP, cwd)
  },
  /** Devuelve si main tiene un turno del curador manual activo para este cwd. */
  isWikiCuratorTurnActive(cwd: string): Promise<boolean> {
    return ipcRenderer.invoke(IPC.WIKI_CURATOR_IS_ACTIVE, cwd)
  },
  onWikiCuratorEvent(cwd: string, cb: (event: WikiCuratorEvent) => void): () => void {
    return subscribeWikiCuratorEvent(cwd, cb)
  },
  startWikiSweep(cwd: string): void {
    ipcRenderer.send(IPC.WIKI_SWEEP_START, cwd)
  },
  stopWikiSweep(cwd: string): void {
    ipcRenderer.send(IPC.WIKI_SWEEP_STOP, cwd)
  },
  onWikiSweepEvent(cwd: string, cb: (event: WikiSweepEvent) => void): () => void {
    return subscribeWikiSweepEvent(cwd, cb)
  },
  getWikiCuratorConfig(cwd: string): Promise<
    { ok: true; config: WikiCuratorConfig } | { ok: false; error: string }
  > {
    return ipcRenderer.invoke(IPC.WIKI_CURATOR_CONFIG_GET, cwd)
  },
  setWikiCuratorConfig(cwd: string, config: WikiCuratorConfig): Promise<
    { ok: true; config: WikiCuratorConfig } | { ok: false; error: string }
  > {
    return ipcRenderer.invoke(IPC.WIKI_CURATOR_CONFIG_SET, cwd, config)
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

  // ─── Discord Rich Presence ─────────────────────────────────────────────────
  /** `false` = Discord no está corriendo; reintentar en el próximo tick. */
  discordPresenceSet(details: string, state: string, startUnixSecs: number): Promise<boolean> {
    return ipcRenderer.invoke(IPC.DISCORD_PRESENCE_SET, details, state, startUnixSecs)
  },
  discordPresenceClear(): Promise<void> {
    return ipcRenderer.invoke(IPC.DISCORD_PRESENCE_CLEAR)
  },
  getAppVersion(): Promise<string> {
    return ipcRenderer.invoke(IPC.APP_VERSION)
  },
  /**
   * Registra en `crash-diagnostics.log` un error no capturado del renderer.
   * `send` y no `invoke`: se llama desde `window.onerror` y desde el
   * ErrorBoundary, donde esperar una respuesta no aporta nada y una promesa
   * rechazada sería otro error sin capturar.
   */
  reportRendererError(payload: RendererErrorReport): void {
    ipcRenderer.send(IPC.APP_RENDERER_ERROR, payload)
  },

  /** `send` y no `invoke`: es telemetría periódica, nadie espera respuesta. */
  reportRendererVitals(payload: RendererVitals): void {
    ipcRenderer.send(IPC.APP_RENDERER_VITALS, payload)
  },

  /**
   * Memoria real del renderer, leída desde el `process` de Electron.
   *
   * Vive en el preload porque el mundo del renderer no tiene `process`, y no en
   * main porque `getAppMetrics()` solo ve el residente del proceso: el reparto
   * entre heap de V8 y PartitionAlloc de Blink solo se ve desde dentro. No usa
   * `performance.memory` justamente para no heredar su cuantización.
   */
  readProcessMemory(): ProcessMemoryReading | null {
    try {
      const heap = process.getHeapStatistics()
      const blink = process.getBlinkMemoryInfo?.()
      return {
        heapUsedKb: heap.usedHeapSize,
        heapTotalKb: heap.totalHeapSize,
        heapLimitKb: heap.heapSizeLimit,
        ...(typeof blink?.allocated === 'number' ? { blinkAllocatedKb: blink.allocated } : {}),
        ...(typeof blink?.total === 'number' ? { blinkTotalKb: blink.total } : {}),
      }
    } catch {
      // Una API que cambie de forma entre versiones de Electron no puede tumbar
      // el muestreo: sin lectura, el sampler cae a `performance.memory`.
      return null
    }
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

  /** Copia archivos elegidos por el usuario al proyecto; devuelve rutas relativas. */
  importContextFiles(options: {
    cwd: string
    rootPath?: string
    title?: string
  }): Promise<
    | { ok: true; paths: string[] }
    | { ok: false; cancelled?: boolean; error?: string }
  > {
    return ipcRenderer.invoke(IPC.CONTEXT_IMPORT_FILES, options)
  },
  selectProjectFiles(options: {
    cwd: string
    rootPath?: string
    title?: string
    importOutside?: boolean
  }): Promise<
    | { ok: true; paths: string[]; imported?: string[] }
    | { ok: false; cancelled?: boolean; error?: string }
  > {
    return ipcRenderer.invoke(IPC.SELECT_PROJECT_FILES, options)
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

  gitListRepos(dirPath: string): Promise<GitListedRepo[]> {
    return ipcRenderer.invoke(IPC.GIT_LIST_REPOS, dirPath)
  },

  gitListReposWithRemote(dirPath: string): Promise<GitRepoRemote[]> {
    return ipcRenderer.invoke(IPC.GIT_LIST_REPOS_WITH_REMOTE, dirPath)
  },

  gitCollectUniqueRepos(paths: string[]): Promise<GitListedRepo[]> {
    return ipcRenderer.invoke(IPC.GIT_COLLECT_UNIQUE_REPOS, paths)
  },

  gitStatus(target: GitTarget): Promise<GitRepoStatus> {
    return ipcRenderer.invoke(IPC.GIT_STATUS, target)
  },

  gitDiffForAi(target: GitTarget): Promise<GitDiffForAiPayload> {
    return ipcRenderer.invoke(IPC.GIT_DIFF_FOR_AI, target)
  },

  gitDiffFile(
    target: GitTarget,
    relPath: string,
    area: 'staged' | 'worktree' | 'untracked',
  ): Promise<GitCommandResult> {
    return ipcRenderer.invoke(IPC.GIT_DIFF_FILE, target, relPath, area)
  },

  gitDiscardFile(target: GitTarget, relPath: string, untracked: boolean): Promise<GitCommandResult> {
    return ipcRenderer.invoke(IPC.GIT_DISCARD_FILE, target, relPath, untracked)
  },

  gitPull(target: GitTarget): Promise<GitCommandResult> {
    return ipcRenderer.invoke(IPC.GIT_PULL, target)
  },

  gitPush(target: GitTarget): Promise<GitCommandResult> {
    return ipcRenderer.invoke(IPC.GIT_PUSH, target)
  },

  /** `meta` solo etiqueta el evento de Pulse; no cambia el commit. */
  gitCommit(
    target: GitTarget,
    message: string,
    meta?: { agentId?: string; workspace?: string },
  ): Promise<GitCommandResult> {
    return ipcRenderer.invoke(IPC.GIT_COMMIT, target, message, meta)
  },

  gitStageAll(target: GitTarget): Promise<GitCommandResult> {
    return ipcRenderer.invoke(IPC.GIT_STAGE_ALL, target)
  },

  gitStageFile(target: GitTarget, relPath: string): Promise<GitCommandResult> {
    return ipcRenderer.invoke(IPC.GIT_STAGE_FILE, target, relPath)
  },

  gitUnstageAll(target: GitTarget): Promise<GitCommandResult> {
    return ipcRenderer.invoke(IPC.GIT_UNSTAGE_ALL, target)
  },

  gitUnstageFile(target: GitTarget, relPath: string): Promise<GitCommandResult> {
    return ipcRenderer.invoke(IPC.GIT_UNSTAGE_FILE, target, relPath)
  },

  gitCurrentBranch(target: GitTarget): Promise<GitCurrentBranchResult> {
    return ipcRenderer.invoke(IPC.GIT_CURRENT_BRANCH, target)
  },

  gitWorktreeAdd(target: GitTarget, request: GitWorktreeAddRequest): Promise<GitWorktreeAddResult> {
    return ipcRenderer.invoke(IPC.GIT_WORKTREE_ADD, target, request)
  },

  gitWorktreeMerge(target: GitTarget, request: GitWorktreeMergeRequest): Promise<GitWorktreeMergeResult> {
    return ipcRenderer.invoke(IPC.GIT_WORKTREE_MERGE, target, request)
  },

  gitWorktreeAbortMerge(target: GitTarget): Promise<GitWorktreeAbortMergeResult> {
    return ipcRenderer.invoke(IPC.GIT_WORKTREE_ABORT_MERGE, target)
  },

  gitWorktreeRemove(target: GitTarget, request: GitWorktreeRemoveRequest): Promise<GitWorktreeRemoveResult> {
    return ipcRenderer.invoke(IPC.GIT_WORKTREE_REMOVE, target, request)
  },

  gitWorktreeList(target: GitTarget): Promise<GitWorktreeEntry[]> {
    return ipcRenderer.invoke(IPC.GIT_WORKTREE_LIST, target)
  },

  githubActionsList(target: GitTarget): Promise<GitHubActionsSnapshot> {
    return ipcRenderer.invoke(IPC.GITHUB_ACTIONS_LIST, target)
  },
  /** Jobs y steps de un run; se pide sólo al desplegar la fila. */
  githubRunJobs(target: GitTarget, runId: number): Promise<GitHubRunJobsResult> {
    return ipcRenderer.invoke(IPC.GITHUB_RUN_JOBS, target, runId)
  },
  /** `token` vacío = comprueba el efectivo (config, entorno o credential helper). */
  githubCheckToken(token: string): Promise<GitHubTokenCheck> {
    return ipcRenderer.invoke(IPC.GITHUB_CHECK_TOKEN, token)
  },
  githubAccountsList(): Promise<
    { ok: true; accounts: GithubAccount[]; defaultAccountId: string } | { ok: false; error: string }
  > {
    return ipcRenderer.invoke(IPC.GITHUB_ACCOUNTS_LIST)
  },
  githubAccountUpsert(input: { id?: string; label: string; token?: string }): Promise<
    { ok: true; account: GithubAccount } | { ok: false; error: string }
  > {
    return ipcRenderer.invoke(IPC.GITHUB_ACCOUNT_UPSERT, input)
  },
  githubAccountDelete(id: string): Promise<{ ok: true } | { ok: false; error: string }> {
    return ipcRenderer.invoke(IPC.GITHUB_ACCOUNT_DELETE, id)
  },
  githubAccountSetDefault(id: string): Promise<{ ok: true } | { ok: false; error: string }> {
    return ipcRenderer.invoke(IPC.GITHUB_ACCOUNT_SET_DEFAULT, id)
  },
  githubWorkspaceAccountGet(
    cwd: string,
  ): Promise<{ ok: true; accountId: string | null } | { ok: false; error: string }> {
    return ipcRenderer.invoke(IPC.GITHUB_WORKSPACE_ACCOUNT_GET, cwd)
  },
  githubWorkspaceAccountSet(
    cwd: string,
    accountId: string | null,
  ): Promise<{ ok: true } | { ok: false; error: string }> {
    return ipcRenderer.invoke(IPC.GITHUB_WORKSPACE_ACCOUNT_SET, cwd, accountId)
  },
  githubReposList(accountId: string, query: string): Promise<GithubRepoListResult> {
    return ipcRenderer.invoke(IPC.GITHUB_REPOS_LIST, accountId, query)
  },

  covenant: {
    status(accountId: string): Promise<CovenantResult<CovenantStatus>> {
      return ipcRenderer.invoke(IPC.COVENANT_STATUS, accountId)
    },
    statusAll(): Promise<CovenantResult<Record<string, CovenantStatus>>> {
      return ipcRenderer.invoke(IPC.COVENANT_STATUS_ALL)
    },
    signIn(accountId: string): Promise<
      { ok: true; data: CovenantStatus } | { ok: false; error: string; source?: GithubTokenSource }
    > {
      return ipcRenderer.invoke(IPC.COVENANT_SIGN_IN, accountId)
    },
    signOut(accountId: string): Promise<CovenantResult<CovenantStatus>> {
      return ipcRenderer.invoke(IPC.COVENANT_SIGN_OUT, accountId)
    },
    orgsList(accountId: string): Promise<CovenantResult<CovenantOrg[]>> {
      return ipcRenderer.invoke(IPC.COVENANT_ORGS_LIST, accountId)
    },
    orgCreate(accountId: string, slug: string, name: string): Promise<CovenantResult<CovenantOrg>> {
      return ipcRenderer.invoke(IPC.COVENANT_ORG_CREATE, accountId, slug, name)
    },
    membersList(accountId: string, slug: string): Promise<CovenantResult<CovenantMember[]>> {
      return ipcRenderer.invoke(IPC.COVENANT_MEMBERS_LIST, accountId, slug)
    },
    memberLoginsList(accountId: string, slug: string): Promise<CovenantResult<string[]>> {
      return ipcRenderer.invoke(IPC.COVENANT_MEMBER_LOGINS_LIST, accountId, slug)
    },
    memberAdd(accountId: string, slug: string, login: string): Promise<CovenantResult<null>> {
      return ipcRenderer.invoke(IPC.COVENANT_MEMBER_ADD, accountId, slug, login)
    },
    memberRemove(accountId: string, slug: string, login: string): Promise<CovenantResult<null>> {
      return ipcRenderer.invoke(IPC.COVENANT_MEMBER_REMOVE, accountId, slug, login)
    },
    defaultsList(accountId: string, slug: string): Promise<CovenantResult<CovenantDefault[]>> {
      return ipcRenderer.invoke(IPC.COVENANT_DEFAULTS_LIST, accountId, slug)
    },
    defaultSet(accountId: string, slug: string, kind: string, name: string): Promise<CovenantResult<null>> {
      return ipcRenderer.invoke(IPC.COVENANT_DEFAULT_SET, accountId, slug, kind, name)
    },
    defaultUnset(accountId: string, slug: string, kind: string, name: string): Promise<CovenantResult<null>> {
      return ipcRenderer.invoke(IPC.COVENANT_DEFAULT_UNSET, accountId, slug, kind, name)
    },
    workspacesList(accountId: string, slug: string): Promise<CovenantResult<CovenantWorkspace[]>> {
      return ipcRenderer.invoke(IPC.COVENANT_WORKSPACES_LIST, accountId, slug)
    },
    workspaceCreate(accountId: string, slug: string, name: string): Promise<CovenantResult<CovenantWorkspace>> {
      return ipcRenderer.invoke(IPC.COVENANT_WORKSPACE_CREATE, accountId, slug, name)
    },
    workspaceRename(
      accountId: string,
      slug: string,
      workspaceId: string,
      name: string,
    ): Promise<CovenantResult<CovenantWorkspace>> {
      return ipcRenderer.invoke(IPC.COVENANT_WORKSPACE_RENAME, accountId, slug, workspaceId, name)
    },
    workspaceDelete(accountId: string, slug: string, workspaceId: string): Promise<CovenantResult<null>> {
      return ipcRenderer.invoke(IPC.COVENANT_WORKSPACE_DELETE, accountId, slug, workspaceId)
    },
    workspaceAssigneeAdd(
      accountId: string,
      slug: string,
      workspaceId: string,
      login: string,
    ): Promise<CovenantResult<null>> {
      return ipcRenderer.invoke(IPC.COVENANT_WORKSPACE_ASSIGNEE_ADD, accountId, slug, workspaceId, login)
    },
    workspaceAssigneeRemove(
      accountId: string,
      slug: string,
      workspaceId: string,
      login: string,
    ): Promise<CovenantResult<null>> {
      return ipcRenderer.invoke(IPC.COVENANT_WORKSPACE_ASSIGNEE_REMOVE, accountId, slug, workspaceId, login)
    },
    workspaceAdminAdd(
      accountId: string,
      slug: string,
      workspaceId: string,
      login: string,
    ): Promise<CovenantResult<null>> {
      return ipcRenderer.invoke(IPC.COVENANT_WORKSPACE_ADMIN_ADD, accountId, slug, workspaceId, login)
    },
    workspaceAdminRemove(
      accountId: string,
      slug: string,
      workspaceId: string,
      login: string,
    ): Promise<CovenantResult<null>> {
      return ipcRenderer.invoke(IPC.COVENANT_WORKSPACE_ADMIN_REMOVE, accountId, slug, workspaceId, login)
    },
    workspaceAgentsList(
      accountId: string,
      slug: string,
      workspaceId: string,
    ): Promise<CovenantResult<CovenantWorkspaceAgentRecord[]>> {
      return ipcRenderer.invoke(IPC.COVENANT_WORKSPACE_AGENTS_LIST, accountId, slug, workspaceId)
    },
    workspaceAgentUpsert(
      accountId: string,
      slug: string,
      workspaceId: string,
      agentId: string,
      definition: ProjectAgentDefinition,
    ): Promise<CovenantResult<CovenantWorkspaceAgentRecord>> {
      return ipcRenderer.invoke(
        IPC.COVENANT_WORKSPACE_AGENT_UPSERT,
        accountId,
        slug,
        workspaceId,
        agentId,
        definition,
      )
    },
    workspaceAgentDelete(
      accountId: string,
      slug: string,
      workspaceId: string,
      agentId: string,
    ): Promise<CovenantResult<null>> {
      return ipcRenderer.invoke(IPC.COVENANT_WORKSPACE_AGENT_DELETE, accountId, slug, workspaceId, agentId)
    },
    workspaceContextsList(
      accountId: string,
      slug: string,
      workspaceId: string,
    ): Promise<CovenantResult<CovenantWorkspaceContextRecord[]>> {
      return ipcRenderer.invoke(IPC.COVENANT_WORKSPACE_CONTEXTS_LIST, accountId, slug, workspaceId)
    },
    workspaceContextUpsert(
      accountId: string,
      slug: string,
      workspaceId: string,
      contextId: string,
      payload: CovenantWorkspaceContextPayload,
    ): Promise<CovenantResult<CovenantWorkspaceContextRecord>> {
      return ipcRenderer.invoke(
        IPC.COVENANT_WORKSPACE_CONTEXT_UPSERT,
        accountId,
        slug,
        workspaceId,
        contextId,
        payload,
      )
    },
    workspaceContextRename(
      accountId: string,
      slug: string,
      workspaceId: string,
      previousId: string,
      nextId: string,
      payload: CovenantWorkspaceContextPayload,
    ): Promise<CovenantResult<{ record: CovenantWorkspaceContextRecord; deletedPrevious: boolean }>> {
      return ipcRenderer.invoke(
        IPC.COVENANT_WORKSPACE_CONTEXT_RENAME,
        accountId,
        slug,
        workspaceId,
        previousId,
        nextId,
        payload,
      )
    },
    workspaceContextDelete(
      accountId: string,
      slug: string,
      workspaceId: string,
      contextId: string,
    ): Promise<CovenantResult<null>> {
      return ipcRenderer.invoke(IPC.COVENANT_WORKSPACE_CONTEXT_DELETE, accountId, slug, workspaceId, contextId)
    },
    listWikiPages(
      accountId: string,
      slug: string,
      workspaceId: string,
    ): Promise<CovenantResult<CovenantWikiPageRecord[]>> {
      return ipcRenderer.invoke(IPC.COVENANT_WIKI_PAGES_LIST, accountId, slug, workspaceId)
    },
    upsertWikiPage(
      accountId: string,
      slug: string,
      workspaceId: string,
      pageSlug: string,
      payload: CovenantWikiPagePayload,
    ): Promise<CovenantResult<CovenantWikiPageRecord>> {
      return ipcRenderer.invoke(
        IPC.COVENANT_WIKI_PAGE_UPSERT,
        accountId,
        slug,
        workspaceId,
        pageSlug,
        payload,
      )
    },
    deleteWikiPage(
      accountId: string,
      slug: string,
      workspaceId: string,
      pageSlug: string,
    ): Promise<CovenantResult<null>> {
      return ipcRenderer.invoke(IPC.COVENANT_WIKI_PAGE_DELETE, accountId, slug, workspaceId, pageSlug)
    },
    appendWikiLog(
      accountId: string,
      slug: string,
      workspaceId: string,
      entry: string,
    ): Promise<CovenantResult<CovenantWikiLogEntryRecord>> {
      return ipcRenderer.invoke(IPC.COVENANT_WIKI_LOG_APPEND, accountId, slug, workspaceId, entry)
    },
    listWikiLog(
      accountId: string,
      slug: string,
      workspaceId: string,
    ): Promise<CovenantResult<CovenantWikiLogEntryRecord[]>> {
      return ipcRenderer.invoke(IPC.COVENANT_WIKI_LOG_LIST, accountId, slug, workspaceId)
    },
    workspaceReposList(
      accountId: string,
      slug: string,
      workspaceId: string,
    ): Promise<CovenantResult<CovenantWorkspaceRepoRecord[]>> {
      return ipcRenderer.invoke(IPC.COVENANT_WORKSPACE_REPOS_LIST, accountId, slug, workspaceId)
    },
    workspaceRepoAdd(
      accountId: string,
      slug: string,
      workspaceId: string,
      payload: CovenantWorkspaceRepoPayload,
    ): Promise<CovenantResult<CovenantWorkspaceRepoRecord>> {
      return ipcRenderer.invoke(IPC.COVENANT_WORKSPACE_REPO_ADD, accountId, slug, workspaceId, payload)
    },
    workspaceRepoUpdate(
      accountId: string,
      slug: string,
      workspaceId: string,
      repoId: string,
      payload: CovenantWorkspaceRepoUpdatePayload,
    ): Promise<CovenantResult<CovenantWorkspaceRepoRecord>> {
      return ipcRenderer.invoke(
        IPC.COVENANT_WORKSPACE_REPO_UPDATE,
        accountId,
        slug,
        workspaceId,
        repoId,
        payload,
      )
    },
    workspaceRepoDelete(
      accountId: string,
      slug: string,
      workspaceId: string,
      repoId: string,
    ): Promise<CovenantResult<null>> {
      return ipcRenderer.invoke(IPC.COVENANT_WORKSPACE_REPO_DELETE, accountId, slug, workspaceId, repoId)
    },
    cloneOrgWorkspace(accountId: string, params: {
      orgSlug: string
      workspaceSlug: string
      repos: Array<OrgWorkspaceCloneRepo>
      workspaceDir?: string
    }): Promise<OrgWorkspaceCloneResult> {
      return ipcRenderer.invoke(IPC.COVENANT_WORKSPACE_CLONE, accountId, params)
    },
    orgAdminsList(accountId: string, slug: string): Promise<CovenantResult<string[]>> {
      return ipcRenderer.invoke(IPC.COVENANT_ORG_ADMINS_LIST, accountId, slug)
    },
    orgAdminAdd(accountId: string, slug: string, login: string): Promise<CovenantResult<null>> {
      return ipcRenderer.invoke(IPC.COVENANT_ORG_ADMIN_ADD, accountId, slug, login)
    },
    orgAdminRemove(accountId: string, slug: string, login: string): Promise<CovenantResult<null>> {
      return ipcRenderer.invoke(IPC.COVENANT_ORG_ADMIN_REMOVE, accountId, slug, login)
    },
  },

  fileExplorerSetRoot(sessionId: string, rootPath: string): Promise<void> {
    return ipcRenderer.invoke(IPC.FILE_EXPLORER_SET_ROOT, sessionId, rootPath)
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

  fileExplorerLoadBytes(
    sessionId: string,
    relPath: string,
    maxBytes: number,
  ): Promise<FileExplorerBytesPayload> {
    return ipcRenderer.invoke(IPC.FILE_EXPLORER_LOAD_BYTES, sessionId, relPath, maxBytes)
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

  searchProjectFiles(cwd: string, query: string): Promise<FileExplorerSearchResult> {
    return ipcRenderer.invoke(IPC.PROJECT_FILE_SEARCH, cwd, query)
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
  renameProjectAgent(
    cwd: string,
    fromId: string,
    definition: import('../src/shared/projectAgentCatalog').ProjectAgentDefinition,
  ): Promise<
    | {
      ok: true
      agent: import('../src/shared/projectAgentCatalog').ProjectAgentDefinition
      fromId: string
      toId: string
      idRemap: Record<string, string>
    }
    | { ok: false; error: string }
  > {
    return ipcRenderer.invoke(IPC.PROJECT_AGENTS_RENAME, cwd, fromId, definition)
  },
  deleteProjectAgent(
    cwd: string,
    agentId: string,
  ): Promise<{ ok: true } | { ok: false; error: string }> {
    return ipcRenderer.invoke(IPC.PROJECT_AGENTS_DELETE, cwd, agentId)
  },
  listBrainstorms(
    cwd: string,
  ): Promise<import('../src/shared/brainstormListing').BrainstormRoomListing[]> {
    return ipcRenderer.invoke(IPC.BRAINSTORM_LIST, cwd)
  },
  saveBrainstorm(
    cwd: string,
    room: import('../src/shared/brainstormRoom').BrainstormRoom,
  ): Promise<
    | { ok: true; room: import('../src/shared/brainstormRoom').BrainstormRoom }
    | { ok: false; error: string }
  > {
    return ipcRenderer.invoke(IPC.BRAINSTORM_UPSERT, cwd, room)
  },
  deleteBrainstorm(
    cwd: string,
    id: string,
  ): Promise<{ ok: true } | { ok: false; error: string }> {
    return ipcRenderer.invoke(IPC.BRAINSTORM_DELETE, cwd, id)
  },
  pruneBrainstorms(
    cwd: string,
    maxAgeDays?: number,
  ): Promise<{ ok: true; removed: number } | { ok: false; error: string }> {
    return ipcRenderer.invoke(IPC.BRAINSTORM_PRUNE, cwd, maxAgeDays)
  },
  exportBrainstormMarkdown(
    cwd: string,
    id: string,
  ): Promise<{ ok: true; path: string } | { ok: false; error: string }> {
    return ipcRenderer.invoke(IPC.BRAINSTORM_EXPORT_MD, cwd, id)
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
  onConfirmQuit(cb: () => void): () => void {
    const listener = (): void => cb()
    ipcRenderer.on(IPC.APP_CONFIRM_QUIT, listener)
    return () => ipcRenderer.removeListener(IPC.APP_CONFIRM_QUIT, listener)
  },
  sendQuitConfirmed(): void {
    ipcRenderer.send(IPC.APP_QUIT_CONFIRMED)
  },
  getUpdateState(): Promise<UpdateState> {
    return ipcRenderer.invoke(IPC.UPDATE_STATE_GET)
  },
  onUpdateState(cb: (state: UpdateState) => void): () => void {
    const listener = (_e: Electron.IpcRendererEvent, state: UpdateState): void => cb(state)
    ipcRenderer.on(IPC.UPDATE_STATE, listener)
    return () => ipcRenderer.removeListener(IPC.UPDATE_STATE, listener)
  },
  installUpdate(): void {
    ipcRenderer.send(IPC.UPDATE_INSTALL)
  },
  dismissUpdate(): void {
    ipcRenderer.send(IPC.UPDATE_DISMISS)
  },
  checkForUpdates(): Promise<UpdateState> {
    return ipcRenderer.invoke(IPC.UPDATE_CHECK)
  },
  pulseSnapshot(scope?: PulseScope): Promise<PulseSnapshot> {
    return ipcRenderer.invoke(IPC.PULSE_SNAPSHOT, scope)
  },

  // ─── Jira ───────────────────────────────────────────────────────────────────
  jiraStatus(
    cwd: string,
  ): Promise<{
    configured: boolean
    site: string
    email: string
    projectKeys: string[]
    connected: boolean
  }> {
    return ipcRenderer.invoke(IPC.JIRA_STATUS, cwd)
  },
  jiraConnect(
    cwd: string,
    input: { site: string; email: string; apiToken: string; projectKeys: string[] },
  ): Promise<{
    ok: boolean
    displayName?: string
    error?: string
    gitignore?: 'appended' | 'already-ignored' | 'skipped'
  }> {
    return ipcRenderer.invoke(IPC.JIRA_CONNECT, cwd, input)
  },
  jiraDisconnect(cwd: string): Promise<{ ok: boolean; error?: string }> {
    return ipcRenderer.invoke(IPC.JIRA_DISCONNECT, cwd)
  },
  jiraSearch(
    cwd: string,
    query: string,
  ): Promise<{ issues: JiraIssueRef[]; error?: string }> {
    return ipcRenderer.invoke(IPC.JIRA_SEARCH, cwd, query)
  },
  jiraPreviewIssue(
    cwd: string,
    issueKey: string,
  ): Promise<{ ok: boolean; content?: string; error?: string }> {
    return ipcRenderer.invoke(IPC.JIRA_PREVIEW_ISSUE, cwd, issueKey)
  },

  githubIssueStatus(
    cwd: string,
  ): Promise<{ connected: boolean; repoFullName: string; error?: string }> {
    return ipcRenderer.invoke(IPC.GITHUB_ISSUE_STATUS, cwd)
  },
  githubIssueSearch(
    cwd: string,
    query: string,
  ): Promise<{ issues: GithubIssueRef[]; error?: string }> {
    return ipcRenderer.invoke(IPC.GITHUB_ISSUE_SEARCH, cwd, query)
  },
  githubIssuePreview(
    cwd: string,
    number: number,
  ): Promise<{ ok: boolean; content?: string; error?: string }> {
    return ipcRenderer.invoke(IPC.GITHUB_ISSUE_PREVIEW, cwd, number)
  },

  // ─── LSP (code intelligence) ───────────────────────────────────────────────
  lspServerStatus(language: string): Promise<LspServerStatus | { error: string }> {
    return ipcRenderer.invoke(IPC.LSP_SERVER_STATUS, language)
  },
  lspDownloadServer(language: string): Promise<{ ok: boolean; error?: string }> {
    return ipcRenderer.invoke(IPC.LSP_DOWNLOAD_SERVER, language)
  },
  lspListInstalled(): Promise<LspInstalledServer[]> {
    return ipcRenderer.invoke(IPC.LSP_LIST_INSTALLED)
  },
  lspDeleteServer(language: string): Promise<{ ok: boolean; error?: string }> {
    return ipcRenderer.invoke(IPC.LSP_DELETE_SERVER, language)
  },
  lspRecheckRuntimes(): Promise<void> {
    return ipcRenderer.invoke(IPC.LSP_RECHECK_RUNTIMES)
  },
  lspStart(sessionId: string, relPath: string): Promise<LspStartResponse> {
    return ipcRenderer.invoke(IPC.LSP_START, sessionId, relPath)
  },
  lspSend(serverId: number, message: string): void {
    ipcRenderer.send(IPC.LSP_SEND, serverId, message)
  },
  lspStop(serverId: number): void {
    ipcRenderer.send(IPC.LSP_STOP, serverId)
  },
  lspReadFile(serverId: number, absPath: string): Promise<LspFileReadResult> {
    return ipcRenderer.invoke(IPC.LSP_READ_FILE, serverId, absPath)
  },
  lspWriteFile(serverId: number, absPath: string, content: string): Promise<LspFileWriteResult> {
    return ipcRenderer.invoke(IPC.LSP_WRITE_FILE, serverId, absPath, content)
  },
  onLspMessage(serverId: number, cb: (message: string) => void): () => void {
    return subscribeLspMessage(String(serverId), cb)
  },
  onLspExit(serverId: number, cb: () => void): () => void {
    return subscribeLspExit(String(serverId), cb)
  },
  onLspDownloadProgress(language: string, cb: (progress: LspDownloadProgress) => void): () => void {
    return subscribeLspDownloadProgress(language, cb)
  },

  // ─── Window chrome ───
  platform: process.platform as NodeJS.Platform,
  isStoreBuild: process.windowsStore === true,
  setTitleBarOverlay(color: string, symbolColor: string): void {
    ipcRenderer.send(IPC.WINDOW_SET_TITLEBAR_OVERLAY, color, symbolColor)
  },

  // ─── Dictation (native macOS SFSpeechRecognizer) ───────────────────────────
  dictationAvailable(): Promise<{
    ok: boolean
    platform: NodeJS.Platform
    error?: string
    message?: string
  }> {
    return ipcRenderer.invoke(IPC.DICTATION_AVAILABLE)
  },
  dictationRequestPermission(): Promise<DictationPermissionResult> {
    return ipcRenderer.invoke(IPC.DICTATION_REQUEST_PERMISSION)
  },
  dictationStart(lang?: string): Promise<{ ok: boolean; error?: string; message?: string }> {
    return ipcRenderer.invoke(IPC.DICTATION_START, lang)
  },
  dictationStop(): Promise<{
    ok: boolean
    text?: string
    error?: string
    message?: string
    /** Pico de audio de la sesión (0–1); el runtime ya lo devuelve. */
    peak?: number
  }> {
    return ipcRenderer.invoke(IPC.DICTATION_STOP)
  },
  onDictationPartial(cb: (text: string) => void): () => void {
    const listener = (_e: Electron.IpcRendererEvent, text: string): void => cb(text)
    ipcRenderer.on(IPC.DICTATION_PARTIAL, listener)
    return () => ipcRenderer.removeListener(IPC.DICTATION_PARTIAL, listener)
  },
  onDictationLevel(cb: (payload: { peak: number; bands: number[] }) => void): () => void {
    const listener = (
      _e: Electron.IpcRendererEvent,
      payload: { peak: number; bands: number[] },
    ): void => cb(payload)
    ipcRenderer.on(IPC.DICTATION_LEVEL, listener)
    return () => ipcRenderer.removeListener(IPC.DICTATION_LEVEL, listener)
  },
  onDictationResult(cb: (text: string) => void): () => void {
    const listener = (_e: Electron.IpcRendererEvent, text: string): void => cb(text)
    ipcRenderer.on(IPC.DICTATION_RESULT, listener)
    return () => ipcRenderer.removeListener(IPC.DICTATION_RESULT, listener)
  },
  onDictationError(cb: (error: { code: string; message: string }) => void): () => void {
    const listener = (
      _e: Electron.IpcRendererEvent,
      error: { code: string; message: string },
    ): void => cb(error)
    ipcRenderer.on(IPC.DICTATION_ERROR, listener)
    return () => ipcRenderer.removeListener(IPC.DICTATION_ERROR, listener)
  },
}

contextBridge.exposeInMainWorld('api', api)

export type API = typeof api
