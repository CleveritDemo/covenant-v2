#!/usr/bin/env node
/**
 * Migra agentes ricos de userData/session.json → <project>/.iaterminal/agents/*.json
 * y deja bindings slim en session.json.
 *
 * Uso:
 *   node scripts/migrate-agents-to-project.mjs
 *   node scripts/migrate-agents-to-project.mjs --session "/path/to/session.json"
 */
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'fs'
import { homedir } from 'os'
import { join } from 'path'
function normalizeAgentSlug(value, fallback = 'agent') {
  const stem = String(value ?? '')
    .trim()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^[.-]+|[.-]+$/g, '')
    .toLowerCase()
    .slice(0, 64)
  return stem || fallback
}

function allocateAgentSlug(preferred, existingIds, fallback = 'agent') {
  const base = normalizeAgentSlug(preferred, fallback)
  if (!existingIds.has(base)) return base
  for (let n = 2; n < 10_000; n += 1) {
    const candidate = `${base}-${n}`.slice(0, 64)
    if (!existingIds.has(candidate)) return candidate
  }
  return `${base}-${Date.now().toString(36)}`.slice(0, 64)
}

function sanitizePermissionMode(raw) {
  if (raw === 'auto') return 'auto'
  if (raw === 'plan' || raw === 'readonly') return 'plan'
  return 'ask'
}

function parseDefinition(raw, id) {
  return {
    id,
    provider: raw.provider === 'cursor' ? 'cursor' : 'claude',
    permissionMode: sanitizePermissionMode(raw.permissionMode),
    ...(typeof raw.name === 'string' && raw.name.trim()
      ? { name: raw.name.trim().slice(0, 48) }
      : {}),
    ...(typeof raw.role === 'string' && raw.role.trim()
      ? { role: raw.role.trim().slice(0, 80) }
      : {}),
    ...(typeof raw.objective === 'string' && raw.objective.trim()
      ? { objective: raw.objective.trim().slice(0, 500) }
      : {}),
    ...(Array.isArray(raw.rules) && raw.rules.length
      ? {
          rules: raw.rules
            .map(r => String(r ?? '').trim().slice(0, 280))
            .filter(Boolean)
            .slice(0, 20),
        }
      : {}),
    ...(typeof raw.model === 'string' && raw.model.trim()
      ? { model: raw.model.trim() }
      : {}),
    ...(typeof raw.color === 'string' && raw.color.trim()
      ? { color: raw.color.trim() }
      : {}),
    ...(Array.isArray(raw.contextIds)
      ? {
          contextIds: raw.contextIds.filter(
            id => typeof id === 'string' && id.trim().length > 0,
          ),
        }
      : {}),
    ...(raw.autoImproveContexts === true ? { autoImproveContexts: true } : {}),
    ...(raw.emitResults === true ? { emitResults: true } : {}),
  }
}

function isLegacyRich(raw) {
  if (!raw || typeof raw !== 'object') return false
  if (typeof raw.agentId === 'string' && raw.agentId.trim()) return false
  return raw.provider === 'claude' || raw.provider === 'cursor'
}

function upsertAgent(cwd, definition) {
  const dir = join(cwd, '.iaterminal', 'agents')
  mkdirSync(dir, { recursive: true })
  const path = join(dir, `${definition.id}.json`)
  const tmp = `${path}.tmp`
  writeFileSync(tmp, `${JSON.stringify(definition, null, 2)}\n`, 'utf-8')
  renameSync(tmp, path)
  return path
}

function defaultSessionPath() {
  return join(homedir(), 'Library', 'Application Support', 'ai-terminal', 'session.json')
}

function main() {
  const args = process.argv.slice(2)
  const sessionIdx = args.indexOf('--session')
  const sessionPath = sessionIdx >= 0
    ? args[sessionIdx + 1]
    : defaultSessionPath()

  if (!sessionPath || !existsSync(sessionPath)) {
    console.error(`No session.json en: ${sessionPath}`)
    process.exit(1)
  }

  const session = JSON.parse(readFileSync(sessionPath, 'utf-8'))
  const cwds = session.cwds ?? {}
  let wrote = 0
  const nextTabs = []

  for (const tab of session.tabs ?? []) {
    const paneIds = Array.isArray(tab.paneIds) ? tab.paneIds : []
    let projectFolder =
      typeof tab.projectFolder === 'string' && tab.projectFolder.trim()
        ? tab.projectFolder.trim()
        : ''
    if (!projectFolder) {
      const terminalIds = paneIds.filter(id => tab.paneKinds?.[id] !== 'agent')
      const ordered = [
        ...terminalIds,
        ...paneIds.filter(id => !terminalIds.includes(id)),
      ]
      projectFolder = ordered.map(id => cwds[id]?.trim() || '').find(Boolean) || ''
    }

    const used = new Set()
    const agentByPane = {}
    for (const paneId of paneIds) {
      if (tab.paneKinds?.[paneId] !== 'agent') continue
      const raw = tab.agentByPane?.[paneId]
      if (raw && typeof raw.agentId === 'string' && raw.agentId.trim()) {
        const agentId = normalizeAgentSlug(raw.agentId)
        used.add(agentId)
        agentByPane[paneId] = {
          agentId,
          ...(typeof raw.cliSessionId === 'string' && raw.cliSessionId.trim()
            ? { cliSessionId: raw.cliSessionId.trim() }
            : {}),
        }
        continue
      }
      if (isLegacyRich(raw) && projectFolder) {
        const preferred =
          typeof raw.name === 'string' && raw.name.trim()
            ? raw.name
            : `agent-${paneId.slice(0, 8)}`
        const id = allocateAgentSlug(preferred, used)
        used.add(id)
        const definition = parseDefinition(raw, id)
        const path = upsertAgent(projectFolder, definition)
        wrote += 1
        console.log(`wrote ${path}`)
        agentByPane[paneId] = {
          agentId: id,
          ...(typeof raw.cliSessionId === 'string' && raw.cliSessionId.trim()
            ? { cliSessionId: raw.cliSessionId.trim() }
            : {}),
        }
        continue
      }
      if (tab.paneKinds?.[paneId] === 'agent') {
        const id = allocateAgentSlug(`agent-${paneId.slice(0, 8)}`, used)
        used.add(id)
        agentByPane[paneId] = { agentId: id }
      }
    }

    nextTabs.push({
      ...tab,
      ...(projectFolder ? { projectFolder } : {}),
      ...(Object.keys(agentByPane).length
        ? { agentByPane }
        : { agentByPane: undefined }),
    })
  }

  const next = { ...session, tabs: nextTabs }
  const tmp = `${sessionPath}.tmp`
  writeFileSync(tmp, JSON.stringify(next, null, 2), 'utf-8')
  renameSync(tmp, sessionPath)
  console.log(`Migrated ${wrote} agent file(s). Updated ${sessionPath}`)
}

main()
