import { existsSync, mkdirSync, readFileSync, renameSync, readdirSync, unlinkSync, writeFileSync } from 'fs'
import { join } from 'path'
import {
  canonicalContextFileName,
  canonicalContextId,
  normalizeContextFileName,
} from '../src/shared/tabContext'
import { parseAgentResultsDoc, withAgentResultsNotes } from '../src/shared/agentResultsDoc'
import {
  normalizeAgentSlug,
  type ProjectAgentDefinition,
} from '../src/shared/projectAgentCatalog'
import { listProjectAgents, upsertProjectAgent } from './projectAgentCatalogOps'
import { projectDirPath } from './projectDir'

export const AGENT_RESULTS_DIR = 'results'
const RESULTS_FENCE_RE = /```ia-terminal-results\s*\n([\s\S]*?)\n```/g
const LOG_ENTRY_RE = /^-\s+`([^`]+)`\s+—\s+(.+)$/gm
const CONTEXT_META_RE = /<!--\s*iaterminal:context\s+(\{[^\n]*\})\s*-->/
const LATEST_RE = /##\s+Latest\s*\n([\s\S]*?)(?=\n##\s|\n<!--\s*\/iaterminal:auto|$)/i
const MAX_LOG_ENTRIES = 30
/** Tope por agente al inyectar results recientes en el prompt del turno. */
export const RECENT_RESULTS_PER_AGENT = 3
const MAX_SUMMARY_WORDS = 70
const MAX_REQUEST_WORDS = 36
const MAX_CHANGE_WORDS = 28
const MAX_CHANGES = 5
/** Línea compacta del Log: solo el summary (prosa). */
const MAX_LOG_LINE_WORDS = 70
const LATEST_PLACEHOLDERS = new Set([
  '(empty)',
  '(no results yet)',
  '(no entries yet)',
  '(no annotations yet)',
])

export interface AiAgentResultPayload {
  summary: string
  /** Qué pidió el usuario en el turno. */
  request?: string
  /** Cambios de código más relevantes (archivo / qué). */
  changes?: string[]
  /**
   * @deprecated shape legacy `{ summary, entries }`.
   * Si no hay `request`/`changes`, se trata como lista de cambios.
   */
  entries: string[]
}

export interface AiAgentResultLogEntry {
  timestamp: string
  text: string
}

export interface RecentAgentResultsGroup {
  agentId: string
  agentName: string
  entries: AiAgentResultLogEntry[]
}

function normalizeText(value: unknown, maxWords: number): string | null {
  if (typeof value !== 'string') return null
  const words = value
    .replace(/\s+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, maxWords)
  return words.length ? words.join(' ') : null
}

function cleanLatest(value: string | undefined): string | null {
  const trimmed = (value ?? '').trim()
  if (!trimmed || LATEST_PLACEHOLDERS.has(trimmed)) return null
  return trimmed
}

function normalizeAgentId(agentId: string): string {
  return normalizeAgentSlug(agentId, 'agent') || 'agent'
}

/** Slug legacy desde display name (migración). */
export function agentResultSlug(agentName: string): string {
  return normalizeContextFileName(agentName, 'agent').replace(/\.md$/i, '')
}

/**
 * Resuelve el agentId de catálogo para results/.
 * Si el caller pasa el display name (p.ej. "fullstack") y hay un único agente
 * con ese nameSlug, usa su id estable (p.ej. "example2").
 */
export function resolveResultsAgentId(cwd: string, agentId: string): string {
  const normalized = normalizeAgentId(agentId)
  if (!normalized) return 'agent'
  const agents = listProjectAgents(cwd)
  if (agents.some(agent => normalizeAgentId(agent.id) === normalized)) {
    return normalized
  }
  const byName = agents.filter(agent => {
    const name = (agent.name ?? '').trim()
    if (!name) return false
    return normalizeAgentId(agentResultSlug(name)) === normalized
  })
  if (byName.length === 1) return normalizeAgentId(byName[0].id)
  return normalized
}

export function agentResultFileName(agentId: string): string {
  return canonicalContextFileName('agentResult', { agentId: normalizeAgentId(agentId) })
}

export function agentResultContextId(agentId: string): string {
  return canonicalContextId('agentResult', { agentId: normalizeAgentId(agentId) })
}

export function resolveAiAgentResultsPath(cwd: string, agentId: string): string {
  const id = normalizeAgentId(agentId)
  return projectDirPath(cwd, AGENT_RESULTS_DIR, `${id}.md`)
}

export function extractAiAgentResults(text: string): {
  visibleText: string
  payload: AiAgentResultPayload | null
} {
  let payload: AiAgentResultPayload | null = null
  const visibleText = text.replace(RESULTS_FENCE_RE, (_match, json: string) => {
    if (payload) return ''
    try {
      const value = JSON.parse(json) as Record<string, unknown>
      const summary = normalizeText(value.summary, MAX_SUMMARY_WORDS)
      if (!summary) return ''
      const request = normalizeText(value.request, MAX_REQUEST_WORDS) ?? undefined
      const changes = Array.isArray(value.changes)
        ? value.changes
          .map(item => normalizeText(item, MAX_CHANGE_WORDS))
          .filter((item): item is string => item !== null)
          .slice(0, MAX_CHANGES)
        : []
      const entries = Array.isArray(value.entries)
        ? value.entries
          .map(item => normalizeText(item, MAX_CHANGE_WORDS))
          .filter((item): item is string => item !== null)
          .slice(0, MAX_CHANGES)
        : []
      payload = {
        summary,
        entries,
        ...(request ? { request } : {}),
        ...(changes.length ? { changes } : {}),
      }
    } catch { /* bloque inválido: se oculta y no se persiste */ }
    return ''
  }).trimEnd()
  return { visibleText, payload }
}

/** Cuerpo de ## Latest: Summary → Request → Changes (o solo summary legacy). */
export function formatLatestBody(payload: AiAgentResultPayload): string {
  const changeLines = payload.changes?.length
    ? payload.changes
    : payload.entries
  const hasStructured = Boolean(payload.request) || changeLines.length > 0
  if (!hasStructured) return payload.summary.trim() || '(empty)'

  const lines: string[] = [`**Summary:** ${payload.summary.trim()}`]
  if (payload.request?.trim()) {
    lines.push(`**Request:** ${payload.request.trim()}`)
  }
  if (changeLines.length) {
    lines.push('**Changes:**')
    for (const change of changeLines) lines.push(`- ${change}`)
  }
  return lines.join('\n')
}

/** Una línea de Log: solo el summary; si falta, el primer change. */
export function formatCompactResultLogLine(payload: AiAgentResultPayload): string {
  const summary = payload.summary.trim()
  if (summary) return normalizeText(summary, MAX_LOG_LINE_WORDS) ?? summary
  const first = (payload.changes?.length ? payload.changes : payload.entries)[0]
  return (first ? normalizeText(first, MAX_LOG_LINE_WORDS) : null) ?? ''
}

function parseLog(raw: string): AiAgentResultLogEntry[] {
  const logSection = raw.match(/##\s+Log\s*\n([\s\S]*?)(?=\n##\s|\n<!--\s*\/iaterminal:auto|$)/i)?.[1] ?? raw
  return [...logSection.matchAll(LOG_ENTRY_RE)]
    .map(match => ({
      timestamp: match[1],
      text: normalizeText(match[2], MAX_LOG_LINE_WORDS) ?? '',
    }))
    .filter(entry => entry.text && !LATEST_PLACEHOLDERS.has(entry.text))
    .slice(0, MAX_LOG_ENTRIES)
}

function parseLatestBody(raw: string): string | null {
  return cleanLatest(raw.match(LATEST_RE)?.[1])
}

function readResultsDisplayName(raw: string, fallback: string): string {
  const match = CONTEXT_META_RE.exec(raw)
  if (!match) return fallback
  try {
    const meta = JSON.parse(match[1]) as { name?: string }
    const name = typeof meta.name === 'string' ? meta.name.trim() : ''
    return name || fallback
  } catch {
    return fallback
  }
}

const NOTES_START = '<!-- iaterminal:notes -->'
const NOTES_END = '<!-- /iaterminal:notes -->'

function extractNotesBody(raw: string): string {
  const start = raw.indexOf(NOTES_START)
  const end = raw.indexOf(NOTES_END)
  if (start < 0 || end < 0 || end <= start) return ''
  return raw.slice(start + NOTES_START.length, end).replace(/^\n|\n$/g, '').trim()
}

export function formatAiAgentResultsDocument(options: {
  agentId: string
  agentName: string
  /** Cuerpo ya formateado de ## Latest. */
  latest: string
  entries: AiAgentResultLogEntry[]
  notes?: string
}): string {
  const agentId = normalizeAgentId(options.agentId)
  const name = options.agentName.trim() || agentId
  const metadata = {
    version: 1,
    id: agentResultContextId(agentId),
    name,
    fileName: agentResultFileName(agentId),
    kind: 'agentResult',
    icon: 'bot',
    color: '#94a3b8',
  }
  const latest = options.latest.trim() || '(empty)'
  const logLines = options.entries.length
    ? options.entries.map(entry => `- \`${entry.timestamp}\` — ${entry.text}`)
    : ['- (no entries yet)']
  const notesBody = (options.notes ?? '').trim() || '(no annotations yet)'
  return [
    `# ${name} — Results`,
    `<!-- iaterminal:context ${JSON.stringify(metadata)} -->`,
    '',
    '<!-- iaterminal:auto -->',
    '## Latest',
    latest,
    '',
    '## Log',
    ...logLines,
    '<!-- /iaterminal:auto -->',
    '',
    NOTES_START,
    notesBody,
    NOTES_END,
    '',
  ].join('\n')
}

function rewriteResultsMetadata(
  raw: string,
  agentId: string,
  displayName: string,
): string {
  const agentIdNorm = normalizeAgentId(agentId)
  const name = displayName.trim() || agentIdNorm
  const metadata = {
    version: 1,
    id: agentResultContextId(agentIdNorm),
    name,
    fileName: agentResultFileName(agentIdNorm),
    kind: 'agentResult',
    icon: 'bot',
    color: '#94a3b8',
  }
  const metaLine = `<!-- iaterminal:context ${JSON.stringify(metadata)} -->`
  let next = raw.includes('iaterminal:context')
    ? raw.replace(CONTEXT_META_RE, metaLine)
    : `${metaLine}\n${raw}`
  // Título: conservar cuerpo; actualizar H1 si existe.
  next = next.replace(/^#\s+.+$/m, `# ${name} — Results`)
  return next
}

/** Reescribe contextIds de agentes según remap old→canonical. */
export function rewriteProjectAgentContextIds(
  cwd: string,
  idRemap: Record<string, string>,
): number {
  const entries = Object.entries(idRemap).filter(([from, to]) => from && to && from !== to)
  if (!entries.length) return 0
  const map = Object.fromEntries(entries)
  let changed = 0
  for (const agent of listProjectAgents(cwd)) {
    const prev = agent.contextIds ?? []
    if (!prev.length) continue
    const seen = new Set<string>()
    const next: string[] = []
    for (const id of prev) {
      const mapped = map[id] ?? id
      if (seen.has(mapped)) continue
      seen.add(mapped)
      next.push(mapped)
    }
    if (next.length === prev.length && next.every((id, i) => id === prev[i])) continue
    const result = upsertProjectAgent(cwd, {
      ...agent,
      ...(next.length ? { contextIds: next } : { contextIds: undefined }),
    })
    if (result.ok) changed += 1
  }
  return changed
}

/** Borra results/<stem>.md cuyo stem no es id de ningún agente del catálogo. */
export function pruneOrphanAgentResults(cwd: string): boolean {
  const resultsDir = projectDirPath(cwd, AGENT_RESULTS_DIR)
  if (!existsSync(resultsDir)) return false
  const agentIds = new Set(listProjectAgents(cwd).map(agent => normalizeAgentId(agent.id)))
  let deleted = false
  try {
    for (const entry of readdirSync(resultsDir)) {
      if (!entry.endsWith('.md')) continue
      const stem = normalizeAgentId(entry.replace(/\.md$/i, ''))
      if (agentIds.has(stem)) continue
      try {
        unlinkSync(join(resultsDir, entry))
        deleted = true
      } catch { /* ignore */ }
    }
  } catch { /* ignore */ }
  return deleted
}

/** Deja solo contextIds que existen en el catálogo descubierto. */
export function pruneProjectAgentContextIds(cwd: string, validIds: ReadonlySet<string>): number {
  let changed = 0
  for (const agent of listProjectAgents(cwd)) {
    const prev = agent.contextIds ?? []
    if (!prev.length) continue
    const next = prev.filter(id => validIds.has(id))
    if (next.length === prev.length && next.every((id, i) => id === prev[i])) continue
    const payload = { ...agent } as ProjectAgentDefinition & { contextIds?: string[] }
    if (next.length) payload.contextIds = next
    else delete payload.contextIds
    const result = upsertProjectAgent(cwd, payload)
    if (result.ok) changed += 1
  }
  return changed
}

/**
 * Migra results/<nameSlug>.md + iaterminal:result:<nameSlug> → agentId estable.
 * Si solo cambia capitalización (APFS), renombra vía temp.
 */
export function migrateLegacyAgentResults(cwd: string): {
  idRemap: Record<string, string>
  migrated: boolean
} {
  const idRemap: Record<string, string> = {}
  let migrated = false
  const resultsDir = projectDirPath(cwd, AGENT_RESULTS_DIR)
  if (!existsSync(resultsDir)) return { idRemap, migrated: false }

  const agents = listProjectAgents(cwd)
  mkdirSync(resultsDir, { recursive: true })

  const renameViaTemp = (fromName: string, toName: string): boolean => {
    if (fromName === toName) return false
    const from = join(resultsDir, fromName)
    const to = join(resultsDir, toName)
    const tmp = join(resultsDir, `._case_${Date.now()}_${process.pid}.md`)
    try {
      renameSync(from, tmp)
      renameSync(tmp, to)
      return true
    } catch {
      try {
        if (existsSync(tmp) && !existsSync(from)) renameSync(tmp, from)
      } catch { /* ignore */ }
      return false
    }
  }

  const findResultsDirent = (stem: string): string | null => {
    const target = `${stem}.md`.toLowerCase()
    try {
      return readdirSync(resultsDir).find(entry => entry.toLowerCase() === target) ?? null
    } catch {
      return null
    }
  }

  for (const agent of agents) {
    const agentId = normalizeAgentId(agent.id)
    const canonicalPath = resolveAiAgentResultsPath(cwd, agentId)
    const canonicalId = agentResultContextId(agentId)
    const nameSlug = agentResultSlug(agent.name || agentId)
    const legacyId = `iaterminal:result:${nameSlug}`
    const legacyPath = join(resultsDir, `${nameSlug}.md`)
    const canonicalFileName = `${agentId}.md`

    // Case-only: Product-Designer.md → product-designer.md vía temp (APFS).
    if (nameSlug.toLowerCase() === agentId.toLowerCase()) {
      const dirent = findResultsDirent(agentId)
      if (dirent && dirent !== canonicalFileName) {
        if (renameViaTemp(dirent, canonicalFileName)) migrated = true
      }
      if (legacyId !== canonicalId) idRemap[legacyId] = canonicalId
    } else if (nameSlug !== agentId && existsSync(legacyPath)) {
      if (!existsSync(canonicalPath)) {
        renameSync(legacyPath, canonicalPath)
        migrated = true
      } else if (nameSlug.toLowerCase() !== agentId.toLowerCase()) {
        // Ambos existen (p.ej. fullstack.md + example2.md): borrar legacy name-slug.
        // No borrar si solo difiere capitalización (FS case-insensitive).
        try {
          unlinkSync(legacyPath)
          migrated = true
        } catch { /* ignore */ }
      }
      if (legacyId !== canonicalId) idRemap[legacyId] = canonicalId
    }

    // Por si el dirent real difiere del nameSlug (casing) aunque nameSlug===agentId.
    {
      const dirent = findResultsDirent(agentId)
      if (dirent && dirent !== canonicalFileName) {
        if (renameViaTemp(dirent, canonicalFileName)) migrated = true
      }
    }

    if (existsSync(canonicalPath)) {
      try {
        const raw = readFileSync(canonicalPath, 'utf8')
        const match = CONTEXT_META_RE.exec(raw)
        if (match) {
          try {
            const meta = JSON.parse(match[1]) as { id?: string }
            if (typeof meta.id === 'string' && meta.id !== canonicalId) {
              idRemap[meta.id] = canonicalId
            }
          } catch { /* ignore */ }
        }
        const updated = rewriteResultsMetadata(raw, agentId, agent.name || agentId)
        if (updated !== raw) {
          writeFileSync(canonicalPath, updated, 'utf8')
          migrated = true
        }
      } catch { /* ignore corrupt */ }
    }

    if (legacyId !== canonicalId && (idRemap[legacyId] || existsSync(canonicalPath))) {
      idRemap[legacyId] = canonicalId
    }
  }

  try {
    const agentIds = new Set(agents.map(agent => normalizeAgentId(agent.id)))
    for (const entry of readdirSync(resultsDir)) {
      if (!entry.endsWith('.md')) continue
      const stem = normalizeAgentId(entry.replace(/\.md$/i, ''))
      // Solo reescribir metadata de files que pertenecen a un agentId vivo.
      if (!agentIds.has(stem)) continue
      const absolute = join(resultsDir, entry)
      let raw = ''
      try {
        raw = readFileSync(absolute, 'utf8')
      } catch {
        continue
      }
      const match = CONTEXT_META_RE.exec(raw)
      if (!match) continue
      try {
        const meta = JSON.parse(match[1]) as { id?: string; name?: string; kind?: string }
        if (meta.kind !== 'agentResult' || typeof meta.id !== 'string') continue
        const canonicalId = agentResultContextId(stem)
        if (meta.id !== canonicalId) {
          idRemap[meta.id] = canonicalId
          const display = typeof meta.name === 'string' ? meta.name : stem
          const updated = rewriteResultsMetadata(raw, stem, display)
          if (updated !== raw) {
            writeFileSync(absolute, updated, 'utf8')
            migrated = true
          }
        }
      } catch { /* ignore */ }
    }
  } catch { /* ignore */ }

  let agentsRewritten = 0
  if (Object.keys(idRemap).length) {
    agentsRewritten = rewriteProjectAgentContextIds(cwd, idRemap)
  }
  if (pruneOrphanAgentResults(cwd)) migrated = true
  return { idRemap, migrated: migrated || agentsRewritten > 0 }
}

/** Crea el .md de resultados si no existe; no sobrescribe contenido previo. */
export function ensureAiAgentResults(
  cwd: string,
  agentId: string,
  agentName?: string,
): string {
  const id = resolveResultsAgentId(cwd, agentId)
  if (!id) return ''
  migrateLegacyAgentResults(cwd)
  const matched = listProjectAgents(cwd).find(agent => normalizeAgentId(agent.id) === id)
  const display = (agentName ?? '').trim() || matched?.name?.trim() || id
  const filePath = resolveAiAgentResultsPath(cwd, id)
  const directory = projectDirPath(cwd, AGENT_RESULTS_DIR)
  mkdirSync(directory, { recursive: true })
  if (existsSync(filePath)) {
    // Actualizar solo name en metadata si cambió el display (rename no mueve archivo).
    try {
      const raw = readFileSync(filePath, 'utf8')
      const updated = rewriteResultsMetadata(raw, id, display)
      if (updated !== raw) writeFileSync(filePath, updated, 'utf8')
    } catch { /* ignore */ }
    pruneOrphanAgentResults(cwd)
    return filePath
  }
  try {
    writeFileSync(
      filePath,
      formatAiAgentResultsDocument({
        agentId: id,
        agentName: display,
        latest: '(no results yet)',
        entries: [],
      }),
      { encoding: 'utf8', flag: 'wx' },
    )
  } catch {
    // Otro panel pudo crearlo entre existsSync y writeFileSync.
  }
  pruneOrphanAgentResults(cwd)
  return filePath
}

/**
 * Guarda las notas humanas de un results sin tocar el bloque `auto` del agente.
 * `agentId` se normaliza a slug, así que la ruta nunca sale de la carpeta de results.
 */
export function writeAiAgentResultsNotes(
  cwd: string,
  agentId: string,
  notes: string,
): { ok: boolean; filePath?: string; error?: string } {
  const id = resolveResultsAgentId(cwd, agentId)
  if (!id) return { ok: false, error: 'Agente inválido.' }
  const filePath = resolveAiAgentResultsPath(cwd, id)
  if (!existsSync(filePath)) return { ok: false, error: 'No existe el archivo de results.' }
  try {
    const raw = readFileSync(filePath, 'utf8')
    const next = withAgentResultsNotes(raw, notes)
    if (next !== raw) writeFileSync(filePath, next, 'utf8')
    return { ok: true, filePath }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) }
  }
}

/** Lee el bloque Latest del results file (misma resolución de id que upsert). */
export function readLatestAiAgentResults(
  cwd: string,
  agentId: string,
): { ok: true; summary: string | null; changes: string[] } | { ok: false; error: string } {
  const id = resolveResultsAgentId(cwd, agentId)
  if (!id) return { ok: false, error: 'Agente inválido.' }
  const filePath = resolveAiAgentResultsPath(cwd, id)
  if (!existsSync(filePath)) return { ok: false, error: 'No existe el archivo de results.' }
  try {
    const raw = readFileSync(filePath, 'utf8')
    const doc = parseAgentResultsDoc(raw)
    return { ok: true, summary: doc.summary, changes: doc.changes }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) }
  }
}

export function upsertAiAgentResults(
  cwd: string,
  agentId: string,
  payload: AiAgentResultPayload,
  options: { agentName?: string; timestamp?: string } = {},
): string {
  const id = resolveResultsAgentId(cwd, agentId)
  if (!id) return ''
  migrateLegacyAgentResults(cwd)
  const matched = listProjectAgents(cwd).find(agent => normalizeAgentId(agent.id) === id)
  const display = (options.agentName ?? '').trim() || matched?.name?.trim() || id
  const timestamp = options.timestamp ?? new Date().toISOString()
  const filePath = resolveAiAgentResultsPath(cwd, id)
  const directory = projectDirPath(cwd, AGENT_RESULTS_DIR)
  mkdirSync(directory, { recursive: true })

  const previousRaw = existsSync(filePath) ? readFileSync(filePath, 'utf8') : ''
  const previousLog = previousRaw ? parseLog(previousRaw) : []
  const previousNotes = previousRaw ? extractNotesBody(previousRaw) : ''
  const logLine = formatCompactResultLogLine(payload)
  const freshEntries = [{ timestamp, text: logLine }]
  const entries = [...freshEntries, ...previousLog].slice(0, MAX_LOG_ENTRIES)
  const content = formatAiAgentResultsDocument({
    agentId: id,
    agentName: display,
    latest: formatLatestBody(payload),
    entries,
    notes: previousNotes && previousNotes !== '(no annotations yet)' ? previousNotes : undefined,
  })
  const temporaryPath = join(directory, `.${id}.tmp`)
  writeFileSync(temporaryPath, content, 'utf8')
  renameSync(temporaryPath, filePath)
  pruneOrphanAgentResults(cwd)
  return filePath
}

/**
 * Últimas entradas publicadas por cada agente del tab (tope por agente).
 * Omite agentes sin results o solo con placeholders.
 */
export function collectRecentAgentResults(
  cwd: string,
  agentIds: readonly string[],
  limitPerAgent = RECENT_RESULTS_PER_AGENT,
): RecentAgentResultsGroup[] {
  const limit = Math.max(1, Math.floor(limitPerAgent))
  const seen = new Set<string>()
  const groups: RecentAgentResultsGroup[] = []
  const catalog = listProjectAgents(cwd)

  for (const rawId of agentIds) {
    const id = normalizeAgentId(rawId)
    if (!id || seen.has(id)) continue
    seen.add(id)
    const filePath = resolveAiAgentResultsPath(cwd, id)
    if (!existsSync(filePath)) continue
    let raw = ''
    try {
      raw = readFileSync(filePath, 'utf8')
    } catch {
      continue
    }
    const matched = catalog.find(agent => normalizeAgentId(agent.id) === id)
    const agentName = readResultsDisplayName(raw, matched?.name?.trim() || id)
    let entries = parseLog(raw).slice(0, limit)
    if (!entries.length) {
      const latest = parseLatestBody(raw)
      if (!latest) continue
      // Una sola línea sintética: el Latest existe pero el Log aún no.
      const flat = latest.replace(/\s+/g, ' ').trim()
      entries = [{ timestamp: '', text: flat }]
    }
    groups.push({ agentId: id, agentName, entries })
  }
  return groups
}

/** Bloque de prompt con results recientes del tab; vacío si no hay nada que mostrar. */
export function buildRecentAgentResultsPrompt(
  cwd: string,
  agentIds: readonly string[],
  limitPerAgent = RECENT_RESULTS_PER_AGENT,
): string {
  const root = cwd.trim()
  if (!root || !agentIds.length) return ''
  const groups = collectRecentAgentResults(root, agentIds, limitPerAgent)
  if (!groups.length) return ''
  const lines = [
    '## Recent agent results',
    'Latest published results from agents in this tab (most recent first per agent). Use them as prior work context; do not repeat unchanged work.',
    '',
  ]
  for (const group of groups) {
    lines.push(`### ${group.agentName} (\`${group.agentId}\`)`)
    for (const entry of group.entries) {
      if (entry.timestamp) {
        lines.push(`- \`${entry.timestamp}\` — ${entry.text}`)
      } else {
        lines.push(`- ${entry.text}`)
      }
    }
    lines.push('')
  }
  return lines.join('\n').trimEnd()
}

export function buildAiAgentResultsInstruction(agentName: string | undefined): string {
  const name = agentName?.trim()
  if (!name) return ''
  return [
    '## Agent results registry',
    `You MUST append the results block on every turn for this agent ("${name}").`,
    'Other agents in the tab read this registry on later turns. Do not omit the block while emit results is enabled.',
    'Write results as if telling a teammate: short, human, ordered. No slogans, no status-only lines (tests passed, ping OK).',
    `Use at most ${MAX_REQUEST_WORDS} words for request, ${MAX_SUMMARY_WORDS} for summary, ${MAX_CHANGE_WORDS} per change (max ${MAX_CHANGES}).`,
    'request: one natural sentence of what was asked.',
    'changes: path + what changed in plain words (e.g. PlaneChatComposer.css: working blur 16→8px).',
    'summary: two or three sentences — what they wanted, what landed, what stayed. Prose, not a formula.',
    'If nothing durable changed, still emit request + summary with an empty changes array.',
    'Append this exact machine-readable block after your normal answer:',
    '```ia-terminal-results',
    '{"request":"Bajar el blur del composer en working","changes":["PlaneChatComposer.css: working blur 16→8px"],"summary":"Pediste menos blur al trabajar. El glass working queda en 8px; el input y el layout no se tocaron."}',
    '```',
  ].join('\n')
}
