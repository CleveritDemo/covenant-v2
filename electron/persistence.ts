import { join } from 'path'
import {
  readFileSync,
  writeFileSync,
  unlinkSync,
  mkdirSync,
  existsSync,
  renameSync,
  rmSync,
  readdirSync,
  statSync,
} from 'fs'
import { app } from 'electron'
import type { TabSession } from '../src/shared/tabSession'
import type { FileExplorerPersistedState } from '../src/shared/fileExplorerPersistedState'
import type { AgentChatEntry } from '../src/shared/agentCliTypes'
import { DEFAULT_THREAD_ID } from '../src/shared/agentThreads'
import {
  agentChatRefFor,
  normalizeAgentChatRef,
  type AgentChatRef,
} from '../src/shared/agentChatPersistence'
import { migratePersistedSessionAgents } from './projectAgentCatalogOps'

const USER_DATA = (): string => app.getPath('userData')

function ensureDir(dir: string): void {
  mkdirSync(dir, { recursive: true })
}

// ─── Session (tabs layout + cwds) ────────────────────────────────────────────

export interface PersistedSession {
  version: 1
  activeTabId: string
  tabs: TabSession[]
  cwds: Record<string, string>
  /** Por tab: explorador de archivos (abierto, selección, carpetas expandidas). */
  explorerByTab?: Record<string, FileExplorerPersistedState>
  /** @deprecated migrado a explorerByTab al cargar. */
  explorerByPane?: Record<string, FileExplorerPersistedState>
}

const SESSION_FILE = (): string => join(USER_DATA(), 'session.json')

export function loadSession(): PersistedSession | null {
  try {
    const path = SESSION_FILE()
    if (!existsSync(path)) return null
    const raw = readFileSync(path, 'utf-8')
    const parsed = JSON.parse(raw) as Partial<PersistedSession>
    if (parsed.version !== 1 || !Array.isArray(parsed.tabs) || !parsed.activeTabId) return null
    const tabs = parsed.tabs.filter(
      t => t && typeof t.id === 'string' && Array.isArray(t.paneIds),
    )
    if (tabs.length === 0) return null
    const activeTabId = tabs.some(t => t.id === parsed.activeTabId)
      ? parsed.activeTabId!
      : tabs[0]!.id
    const session: PersistedSession = {
      version: 1,
      activeTabId,
      tabs: tabs as TabSession[],
      cwds: parsed.cwds ?? {},
      explorerByTab: parsed.explorerByTab,
      explorerByPane: parsed.explorerByPane,
    }
    const migrated = migratePersistedSessionAgents(session)
    if (migrated.changed) {
      saveSession(migrated.session)
      return migrated.session
    }
    return session
  } catch {
    return null
  }
}

export function saveSession(data: PersistedSession): void {
  try {
    const path = SESSION_FILE()
    ensureDir(USER_DATA())
    const tmp = `${path}.tmp`
    // Evita persistir `projectFolder: null` (IPC structured-clone convierte undefined→null).
    const tabs = data.tabs.map(tab => {
      const folder = typeof tab.projectFolder === 'string' ? tab.projectFolder.trim() : ''
      if (folder) return { ...tab, projectFolder: folder }
      const { projectFolder: _dropped, ...rest } = tab
      return rest
    })
    writeFileSync(tmp, JSON.stringify({ ...data, tabs }), 'utf-8')
    renameSync(tmp, path)
  } catch { /* ignore */ }
}

// ─── AI Chat history ─────────────────────────────────────────────────────────

export interface ChatEntry {
  id: string
  role: 'user' | 'assistant'
  content: string
  /** Contenido de razonamiento interno emitido por el modelo en modo thinking. */
  thinking?: string
}

const aiChatDir = (): string => join(USER_DATA(), 'ai-chats')
const aiChatFile = (paneId: string): string => join(aiChatDir(), `${paneId}.json`)

function isValidChatEntry(x: unknown): x is ChatEntry {
  if (!x || typeof x !== 'object') return false
  const e = x as Record<string, unknown>
  return (
    typeof e.id === 'string' &&
    (e.role === 'user' || e.role === 'assistant') &&
    typeof e.content === 'string' &&
    (e.thinking === undefined || typeof e.thinking === 'string')
  )
}

export function loadAiChat(paneId: string): ChatEntry[] {
  try {
    const path = aiChatFile(paneId)
    if (!existsSync(path)) return []
    const raw = readFileSync(path, 'utf-8')
    const data = JSON.parse(raw) as unknown
    if (!Array.isArray(data)) return []
    return data.filter(isValidChatEntry)
  } catch {
    return []
  }
}

export function saveAiChat(paneId: string, entries: ChatEntry[]): void {
  try {
    ensureDir(aiChatDir())
    writeFileSync(aiChatFile(paneId), JSON.stringify(entries), 'utf-8')
  } catch { /* ignore */ }
}

export function deleteAiChat(paneId: string): void {
  try {
    const path = aiChatFile(paneId)
    if (existsSync(path)) unlinkSync(path)
  } catch { /* ignore */ }
}

// ─── Historial de comandos (sugerencias recientes; mismo paneId que chat IA) ─

const MAX_CMD_HISTORY_LINES = 120

const cmdHistoryDir = (): string => join(USER_DATA(), 'cmd-history')
const cmdHistoryFile = (paneId: string): string => join(cmdHistoryDir(), `${paneId}.json`)

export function loadCmdHistory(paneId: string): string[] {
  try {
    const path = cmdHistoryFile(paneId)
    if (!existsSync(path)) return []
    const raw = readFileSync(path, 'utf-8')
    const data = JSON.parse(raw) as unknown
    if (!Array.isArray(data)) return []
    const lines = data.filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
    return lines.slice(0, MAX_CMD_HISTORY_LINES)
  } catch {
    return []
  }
}

export function saveCmdHistory(paneId: string, lines: string[]): void {
  try {
    const trimmed = lines
      .filter(l => typeof l === 'string' && l.trim().length > 0)
      .slice(0, MAX_CMD_HISTORY_LINES)
    ensureDir(cmdHistoryDir())
    writeFileSync(cmdHistoryFile(paneId), JSON.stringify(trimmed), 'utf-8')
  } catch { /* ignore */ }
}

export function deleteCmdHistory(paneId: string): void {
  try {
    const path = cmdHistoryFile(paneId)
    if (existsSync(path)) unlinkSync(path)
  } catch { /* ignore */ }
}

// ─── Interactions log ─────────────────────────────────────────────────────────

const interactionsLogDir = (): string => join(USER_DATA(), 'interactions-log')
const interactionsLogFile = (paneId: string): string => join(interactionsLogDir(), `${paneId}.json`)

export function loadInteractionsLog(paneId: string): string[] {
  try {
    const path = interactionsLogFile(paneId)
    if (!existsSync(path)) return []
    const raw = readFileSync(path, 'utf-8')
    const data = JSON.parse(raw) as unknown
    if (!Array.isArray(data)) return []
    return data.filter((x): x is string => typeof x === 'string')
  } catch {
    return []
  }
}

export function saveInteractionsLog(paneId: string, entries: string[]): void {
  try {
    ensureDir(interactionsLogDir())
    writeFileSync(interactionsLogFile(paneId), JSON.stringify(entries), 'utf-8')
  } catch { /* ignore */ }
}

export function deleteInteractionsLog(paneId: string): void {
  try {
    const path = interactionsLogFile(paneId)
    if (existsSync(path)) unlinkSync(path)
  } catch { /* ignore */ }
}

// ─── Scrollback ───────────────────────────────────────────────────────────────

const scrollbackDir = (): string => join(USER_DATA(), 'scrollbacks')
const scrollbackFile = (paneId: string): string => join(scrollbackDir(), `${paneId}.txt`)

export function loadScrollback(paneId: string): string | null {
  try {
    const path = scrollbackFile(paneId)
    if (!existsSync(path)) return null
    return readFileSync(path, 'utf-8')
  } catch {
    return null
  }
}

export function saveScrollback(paneId: string, data: string): void {
  try {
    ensureDir(scrollbackDir())
    writeFileSync(scrollbackFile(paneId), data, 'utf-8')
  } catch { /* ignore */ }
}

export function deleteScrollback(paneId: string): void {
  try {
    const path = scrollbackFile(paneId)
    if (existsSync(path)) unlinkSync(path)
  } catch { /* ignore */ }
}

// ─── Agent CLI chat history ─────────────────────────────────────────────────
// Archivos bajo agent-chats/: clave estable (agentId+scope) o legacy paneId.json.

const agentChatDir = (): string => join(USER_DATA(), 'agent-chats')

/**
 * Las claves vienen del renderer y arman un path: nada de separadores ni `..`.
 * Los callers ya envuelven en try/catch, así que el throw degrada a "sin
 * historial" en vez de escribir fuera de la carpeta.
 */
function safeId(value: string): string {
  if (!/^[A-Za-z0-9._-]{1,160}$/.test(value) || value.includes('..')) {
    throw new Error(`id inválido: ${value}`)
  }
  return value
}

/**
 * Una carpeta por agente (clave estable agentId+scope) y un archivo por
 * conversación dentro. Las dos claves son ortogonales: la de la carpeta
 * sobrevive a un cambio de `paneId`, la del archivo distingue los hilos.
 */
const agentChatKeyDir = (storageKey: string): string => join(agentChatDir(), safeId(storageKey))
const agentChatFile = (storageKey: string, threadId: string): string =>
  join(agentChatKeyDir(storageKey), `${safeId(threadId)}.json`)
/** Transcript plano pre-threads: un solo archivo por clave (o por paneId). */
const flatAgentChatFile = (key: string): string => join(agentChatDir(), `${safeId(key)}.json`)

function isAgentChatImage(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false
  const image = value as Record<string, unknown>
  return typeof image.name === 'string' && typeof image.dataUrl === 'string'
}

function isAgentChatEntry(value: unknown): value is AgentChatEntry {
  if (!value || typeof value !== 'object') return false
  const entry = value as Record<string, unknown>
  return (
    typeof entry.id === 'string' &&
    (entry.role === 'user' || entry.role === 'assistant' || entry.role === 'system') &&
    typeof entry.content === 'string' &&
    (entry.images === undefined ||
      (Array.isArray(entry.images) && entry.images.every(isAgentChatImage))) &&
    // Historial anterior no la trae; la UI cae a detectar el encabezado.
    (entry.presentation === undefined || entry.presentation === 'delegationResult')
  )
}

function readAgentChatFile(path: string): AgentChatEntry[] {
  try {
    if (!existsSync(path)) return []
    const data = JSON.parse(readFileSync(path, 'utf-8')) as unknown
    return Array.isArray(data) ? data.filter(isAgentChatEntry) : []
  } catch {
    return []
  }
}

/**
 * Adopta el transcript plano pre-threads como primer hilo. Se prueba la clave
 * estable y después el `paneId` viejo: son las dos formas en que pudo quedar
 * escrito antes de que un agente tuviera varias conversaciones.
 */
function adoptFlatTranscript(
  storageKey: string,
  legacyPaneId: string | undefined,
  target: string,
): void {
  for (const key of [storageKey, legacyPaneId]) {
    if (!key) continue
    const flat = flatAgentChatFile(key)
    if (!existsSync(flat)) continue
    ensureDir(agentChatKeyDir(storageKey))
    renameSync(flat, target)
    return
  }
}

export function loadAgentChat(
  ref: AgentChatRef | string,
  threadId: string,
): AgentChatEntry[] {
  try {
    const { storageKey, legacyPaneId } = normalizeAgentChatRef(ref)
    const path = agentChatFile(storageKey, threadId)
    if (!existsSync(path) && threadId === DEFAULT_THREAD_ID) {
      adoptFlatTranscript(storageKey, legacyPaneId, path)
    }
    return readAgentChatFile(path)
  } catch {
    return []
  }
}

export function saveAgentChat(
  ref: AgentChatRef | string,
  threadId: string,
  entries: AgentChatEntry[],
): void {
  try {
    const { storageKey } = normalizeAgentChatRef(ref)
    ensureDir(agentChatKeyDir(storageKey))
    writeFileSync(agentChatFile(storageKey, threadId), JSON.stringify(entries), 'utf-8')
  } catch { /* ignore */ }
}

/**
 * Borra transcripts de hilos que ya no existen en ningún binding de la sesión.
 *
 * El tope de threads por pane poda el catálogo pero deja el `.json` en disco, y
 * los carriles de delegación de una ola grande dejan decenas por especialista
 * (en un caso real: 32 MB en un solo agente). Corre una vez por arranque y
 * **antes** de que el renderer cree nada: con carriles vivos, un hilo recién
 * abierto todavía no está en el archivo de sesión y se borraría su transcript.
 *
 * La carpeta es por `storageKey` (agentId+scope), que dos panes pueden
 * compartir: los hilos a conservar se unen por clave, no por pane.
 */
export function sweepOrphanAgentChats(
  session: PersistedSession,
): { deleted: number; bytes: number } {
  const keepByKey = new Map<string, Set<string>>()
  for (const tab of session.tabs) {
    const folder = tab.projectFolder?.trim()
    const slug = tab.orgWorkspace?.slug?.trim()
    const workspaceId = tab.orgWorkspace?.workspaceId?.trim()
    const scope = {
      ...(folder ? { projectFolder: folder } : {}),
      ...(slug && workspaceId ? { orgWorkspace: { slug, workspaceId } } : {}),
    }
    for (const [paneId, binding] of Object.entries(tab.agentByPane ?? {})) {
      if (!binding) continue
      let storageKey: string
      try {
        storageKey = agentChatRefFor(scope, binding.agentId, paneId).storageKey
      } catch {
        continue
      }
      const keep = keepByKey.get(storageKey) ?? new Set<string>()
      // El hilo por defecto puede materializarse al adoptar un transcript
      // plano pre-threads, así que nunca se barre.
      keep.add(DEFAULT_THREAD_ID)
      for (const thread of binding.threads ?? []) {
        if (thread?.id) keep.add(thread.id)
      }
      if (binding.activeThreadId) keep.add(binding.activeThreadId)
      keepByKey.set(storageKey, keep)
    }
  }

  let deleted = 0
  let bytes = 0
  for (const [storageKey, keep] of keepByKey) {
    let dir: string
    try {
      dir = agentChatKeyDir(storageKey)
    } catch {
      continue
    }
    if (!existsSync(dir)) continue
    let files: string[]
    try {
      files = readdirSync(dir)
    } catch {
      continue
    }
    for (const file of files) {
      if (!file.endsWith('.json')) continue
      const threadId = file.slice(0, -'.json'.length)
      if (keep.has(threadId)) continue
      const path = join(dir, file)
      try {
        bytes += statSync(path).size
        unlinkSync(path)
        deleted += 1
      } catch { /* ignore */ }
    }
  }
  return { deleted, bytes }
}

/** Sin `threadId` borra el agente entero (al cerrar el pane); con él, un hilo. */
export function deleteAgentChat(ref: AgentChatRef | string, threadId?: string): void {
  try {
    const { storageKey, legacyPaneId } = normalizeAgentChatRef(ref)
    if (threadId) {
      const path = agentChatFile(storageKey, threadId)
      if (existsSync(path)) unlinkSync(path)
      return
    }
    rmSync(agentChatKeyDir(storageKey), { recursive: true, force: true })
    for (const key of [storageKey, legacyPaneId]) {
      if (!key) continue
      const flat = flatAgentChatFile(key)
      if (existsSync(flat)) unlinkSync(flat)
    }
  } catch { /* ignore */ }
}
