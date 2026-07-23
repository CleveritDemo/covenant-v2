import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'fs'
import { basename, join } from 'path'
import {
  PROJECT_AGENTS_DIR,
  normalizeAgentSlug,
  parseProjectAgentDefinition,
  planAgentCatalogMigration,
  projectAgentFileName,
  type ProjectAgentDefinition,
} from '../src/shared/projectAgentCatalog'
import type { PersistedSession } from './persistence'

function agentsDir(cwd: string): string {
  return join(cwd, '.iaterminal', PROJECT_AGENTS_DIR)
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
  return out
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

/**
 * Escribe definiciones legacy de session.json en `.iaterminal/agents` y
 * devuelve la sesión con bindings slim. Idempotente si ya está migrada.
 */
export function migratePersistedSessionAgents(
  session: PersistedSession,
): { session: PersistedSession; wrote: number; changed: boolean } {
  const planned = planAgentCatalogMigration(session.tabs, session.cwds)
  let wrote = 0
  for (const item of planned.writes) {
    const result = upsertProjectAgent(item.projectFolder, item.definition)
    if (result.ok) wrote += 1
  }
  if (!planned.changed) return { session, wrote: 0, changed: false }
  return {
    wrote,
    changed: true,
    session: {
      ...session,
      tabs: planned.tabs as PersistedSession['tabs'],
    },
  }
}
