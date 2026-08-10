import { join } from 'path'
import { readFileSync, writeFileSync, unlinkSync, mkdirSync, existsSync, renameSync } from 'fs'
import { app } from 'electron'
import type { TabSession } from '../src/shared/tabSession'
import type { FileExplorerPersistedState } from '../src/shared/fileExplorerPersistedState'
import type { AgentChatEntry } from '../src/shared/agentCliTypes'
import {
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
const agentChatFile = (storageKey: string): string => join(agentChatDir(), `${storageKey}.json`)

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
      (Array.isArray(entry.images) && entry.images.every(isAgentChatImage)))
  )
}

function readAgentChatFile(storageKey: string): AgentChatEntry[] {
  try {
    const path = agentChatFile(storageKey)
    if (!existsSync(path)) return []
    const data = JSON.parse(readFileSync(path, 'utf-8')) as unknown
    return Array.isArray(data) ? data.filter(isAgentChatEntry) : []
  } catch {
    return []
  }
}

function writeAgentChatFile(storageKey: string, entries: AgentChatEntry[]): void {
  ensureDir(agentChatDir())
  writeFileSync(agentChatFile(storageKey), JSON.stringify(entries), 'utf-8')
}

function unlinkAgentChatFile(storageKey: string): void {
  try {
    const path = agentChatFile(storageKey)
    if (existsSync(path)) unlinkSync(path)
  } catch { /* ignore */ }
}

/**
 * Carga el transcript por clave estable; si falta, migra desde legacy paneId.
 */
export function loadAgentChat(ref: AgentChatRef | string): AgentChatEntry[] {
  const { storageKey, legacyPaneId } = normalizeAgentChatRef(ref)
  const primary = readAgentChatFile(storageKey)
  if (primary.length > 0) {
    if (legacyPaneId) unlinkAgentChatFile(legacyPaneId)
    return primary
  }
  if (!legacyPaneId) return []
  const legacy = readAgentChatFile(legacyPaneId)
  if (legacy.length === 0) return []
  try {
    writeAgentChatFile(storageKey, legacy)
    unlinkAgentChatFile(legacyPaneId)
  } catch { /* ignore */ }
  return legacy
}

export function saveAgentChat(ref: AgentChatRef | string, entries: AgentChatEntry[]): void {
  try {
    const { storageKey, legacyPaneId } = normalizeAgentChatRef(ref)
    writeAgentChatFile(storageKey, entries)
    if (legacyPaneId) unlinkAgentChatFile(legacyPaneId)
  } catch { /* ignore */ }
}

export function deleteAgentChat(ref: AgentChatRef | string): void {
  const { storageKey, legacyPaneId } = normalizeAgentChatRef(ref)
  unlinkAgentChatFile(storageKey)
  if (legacyPaneId) unlinkAgentChatFile(legacyPaneId)
}
