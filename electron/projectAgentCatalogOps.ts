import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'fs'
import { basename, join } from 'path'
import {
  PROJECT_AGENTS_DIR,
  agentResultContextIdForSlug,
  normalizeAgentSlug,
  parseProjectAgentDefinition,
  planAgentCatalogMigration,
  projectAgentFileName,
  remapAgentResultContextIds,
  sortProjectAgentsByPlaneOrder,
  type ProjectAgentDefinition,
} from '../src/shared/projectAgentCatalog'
import { projectDirPath } from './projectDir'
import type { PersistedSession } from './persistence'

function agentsDir(cwd: string): string {
  return projectDirPath(cwd, PROJECT_AGENTS_DIR)
}

function ensureAgentsDir(cwd: string): string {
  const dir = agentsDir(cwd)
  mkdirSync(dir, { recursive: true })
  return dir
}

function agentPath(cwd: string, id: string): string {
  return join(agentsDir(cwd), projectAgentFileName(id))
}

export function listProjectAgents(cwd: string): ProjectAgentDefinition[] {
  const root = typeof cwd === 'string' ? cwd.trim() : ''
  if (!root) return []
  const dir = agentsDir(root)
  if (!existsSync(dir)) return []
  let names: string[] = []
  try {
    names = readdirSync(dir).filter(name => name.endsWith('.json'))
  } catch {
    return []
  }
  const out: ProjectAgentDefinition[] = []
  for (const name of names.sort()) {
    try {
      const raw = JSON.parse(readFileSync(join(dir, name), 'utf-8')) as unknown
      const hint = basename(name, '.json')
      const parsed = parseProjectAgentDefinition(raw, hint)
      if (parsed) out.push(parsed)
    } catch { /* skip corrupt */ }
  }
  return sortProjectAgentsByPlaneOrder(out)
}

export function upsertProjectAgent(
  cwd: string,
  definition: ProjectAgentDefinition,
): { ok: true; agent: ProjectAgentDefinition } | { ok: false; error: string } {
  const root = typeof cwd === 'string' ? cwd.trim() : ''
  if (!root) return { ok: false, error: 'missing_cwd' }
  const parsed = parseProjectAgentDefinition(definition, definition.id)
  if (!parsed) return { ok: false, error: 'invalid_agent' }
  try {
    ensureAgentsDir(root)
    const path = agentPath(root, parsed.id)
    const tmp = `${path}.tmp`
    writeFileSync(tmp, `${JSON.stringify(parsed, null, 2)}\n`, 'utf-8')
    renameSync(tmp, path)
    return { ok: true, agent: parsed }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'write_failed',
    }
  }
}

export function deleteProjectAgent(
  cwd: string,
  agentId: string,
): { ok: true } | { ok: false; error: string } {
  const root = typeof cwd === 'string' ? cwd.trim() : ''
  const id = normalizeAgentSlug(agentId)
  if (!root || !id) return { ok: false, error: 'missing_args' }
  try {
    const path = agentPath(root, id)
    if (existsSync(path)) unlinkSync(path)
    return { ok: true }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'delete_failed',
    }
  }
}

function resultsPath(cwd: string, id: string): string {
  return projectDirPath(cwd, 'results', `${normalizeAgentSlug(id)}.md`)
}

function rewriteResultsFileAfterRename(
  cwd: string,
  fromId: string,
  toId: string,
  displayName?: string,
): void {
  const from = normalizeAgentSlug(fromId)
  const to = normalizeAgentSlug(toId)
  if (!from || !to || from === to) return
  const fromFile = resultsPath(cwd, from)
  const toFile = resultsPath(cwd, to)
  if (!existsSync(fromFile)) return
  try {
    if (!existsSync(toFile)) {
      renameSync(fromFile, toFile)
    } else if (fromFile !== toFile) {
      unlinkSync(fromFile)
    }
  } catch { /* ignore fs races */ }

  if (!existsSync(toFile)) return
  try {
    const raw = readFileSync(toFile, 'utf-8')
    const name = (displayName ?? '').trim() || to
    const nextMeta = {
      version: 1,
      id: agentResultContextIdForSlug(to),
      name,
      fileName: `results/${to}.md`,
      kind: 'agentResult',
      icon: 'bot',
      color: '#94a3b8',
    }
    const metaLine = `<!-- iaterminal:context ${JSON.stringify(nextMeta)} -->`
    let next = /<!--\s*iaterminal:context\s+\{[^\n]*\}\s*-->/.test(raw)
      ? raw.replace(/<!--\s*iaterminal:context\s+\{[^\n]*\}\s*-->/, metaLine)
      : `${metaLine}\n${raw}`
    next = next.replace(/^#\s+.+$/m, `# ${name} — Results`)
    if (next !== raw) writeFileSync(toFile, next, 'utf-8')
  } catch { /* ignore corrupt */ }
}

function remapResultContextIdsOnDisk(
  cwd: string,
  fromId: string,
  toId: string,
): void {
  const fromCtx = agentResultContextIdForSlug(fromId)
  const toCtx = agentResultContextIdForSlug(toId)
  if (fromCtx === toCtx) return
  for (const agent of listProjectAgents(cwd)) {
    const remapped = remapAgentResultContextIds(agent.contextIds, fromId, toId)
    if (!remapped) continue
    const prev = agent.contextIds ?? []
    if (remapped.length === prev.length && remapped.every((id, i) => id === prev[i])) {
      continue
    }
    const { contextIds: _prev, ...rest } = agent
    upsertProjectAgent(cwd, {
      ...rest,
      ...(remapped.length ? { contextIds: remapped } : {}),
    })
  }
}

/**
 * Renombra el slug del JSON en la carpeta `agents` (y results asociados).
 * Si fromId === toId, equivale a upsert.
 */
export function renameProjectAgent(
  cwd: string,
  fromId: string,
  definition: ProjectAgentDefinition,
): {
  ok: true
  agent: ProjectAgentDefinition
  fromId: string
  toId: string
  idRemap: Record<string, string>
}
  | { ok: false; error: string } {
  const root = typeof cwd === 'string' ? cwd.trim() : ''
  const from = normalizeAgentSlug(fromId)
  if (!root || !from) return { ok: false, error: 'missing_args' }

  const toHint = normalizeAgentSlug(definition.id) || from
  const remappedIds = remapAgentResultContextIds(definition.contextIds, from, toHint)
  const { contextIds: _previousContextIds, ...restDefinition } = definition
  const withRemapped: ProjectAgentDefinition = {
    ...restDefinition,
    ...(remappedIds?.length ? { contextIds: remappedIds } : {}),
  }
  const parsed = parseProjectAgentDefinition(withRemapped, definition.id)
  if (!parsed) return { ok: false, error: 'invalid_agent' }
  const to = parsed.id

  if (from === to) {
    const written = upsertProjectAgent(root, parsed)
    if (!written.ok) return written
    return {
      ok: true,
      agent: written.agent,
      fromId: from,
      toId: to,
      idRemap: {},
    }
  }

  const taken = listProjectAgents(root).some(agent => agent.id === to)
  if (taken) return { ok: false, error: 'slug_taken' }

  const written = upsertProjectAgent(root, parsed)
  if (!written.ok) return written

  try {
    const oldPath = agentPath(root, from)
    if (existsSync(oldPath) && oldPath !== agentPath(root, to)) {
      unlinkSync(oldPath)
    }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'rename_failed',
    }
  }

  rewriteResultsFileAfterRename(root, from, to, parsed.name)
  remapResultContextIdsOnDisk(root, from, to)
  return {
    ok: true,
    agent: written.agent,
    fromId: from,
    toId: to,
    idRemap: {
      [agentResultContextIdForSlug(from)]: agentResultContextIdForSlug(to),
    },
  }
}

/**
 * Descarta rich meta legacy de session (sin escribir agentes en disco).
 * Agentes solo desde la carpeta `agents` del proyecto. `wrote` siempre 0.
 */
export function migratePersistedSessionAgents(
  session: PersistedSession,
): { session: PersistedSession; wrote: number; changed: boolean } {
  const planned = planAgentCatalogMigration(session.tabs, session.cwds)
  if (!planned.changed) return { session, wrote: 0, changed: false }
  return {
    wrote: 0,
    changed: true,
    session: {
      ...session,
      tabs: planned.tabs as PersistedSession['tabs'],
    },
  }
}
