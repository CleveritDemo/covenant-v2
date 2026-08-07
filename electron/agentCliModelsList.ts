/**
 * Lista modelos reales de Claude / Cursor / Copilot CLI.
 * No toca commandAndArgs de ejecución de agentes.
 */
import crossSpawn from 'cross-spawn'
import { existsSync, readFileSync, readdirSync } from 'fs'
import { basename, dirname, join } from 'path'
import type { AppConfig } from '../src/shared/configSchema'
import type {
  AgentCliModelsResult,
  AgentModelOption,
} from '../src/shared/agentCliModels'
import { modelsForProvider } from '../src/shared/agentCliModels'
import { agentCliCommand, type AgentCliProvider } from '../src/shared/agentCliProviders'
import { resolveCliExecutable, resolveCommandAbsolutePath } from './shellPathEnv'

const LIST_TIMEOUT_MS = 12_000

function humanizeModelId(id: string): string {
  return id
    .replace(/[-_]+/g, ' ')
    .replace(/\b([a-z])/g, char => char.toUpperCase())
}

function dedupeModels(models: AgentModelOption[]): AgentModelOption[] {
  const seen = new Set<string>()
  const out: AgentModelOption[] = []
  for (const model of models) {
    const id = model.id.trim()
    if (!id || seen.has(id)) continue
    seen.add(id)
    out.push({
      id,
      label: model.label.trim() || humanizeModelId(id),
    })
  }
  return out
}

/** Cursor: `id - Label` (salida de `agent --list-models`). */
export function parseCursorModelsStdout(stdout: string): AgentModelOption[] {
  const models: AgentModelOption[] = []
  for (const raw of stdout.split(/\r?\n/)) {
    const line = raw.trim()
    if (!line || /^available models$/i.test(line)) continue
    const match = line.match(/^([A-Za-z0-9._:-]+)\s+-\s+(.+)$/)
    if (!match) continue
    models.push({ id: match[1], label: match[2].trim() })
  }
  return dedupeModels(models)
}

/**
 * Claude: `claude models` (texto o JSON) o aliases citados en `--help`.
 */
export function parseClaudeModelsStdout(stdout: string): AgentModelOption[] {
  const trimmed = stdout.trim()
  if (!trimmed) return []

  // JSON error / result envelope
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      const value = JSON.parse(trimmed) as unknown
      if (Array.isArray(value)) {
        return dedupeModels(value.flatMap(item => {
          if (typeof item === 'string' && item.trim()) {
            return [{ id: item.trim(), label: humanizeModelId(item.trim()) }]
          }
          if (item && typeof item === 'object') {
            const rec = item as Record<string, unknown>
            const id = typeof rec.id === 'string' ? rec.id.trim()
              : typeof rec.value === 'string' ? rec.value.trim()
                : typeof rec.model === 'string' ? rec.model.trim()
                  : ''
            if (!id) return []
            const label = typeof rec.label === 'string' ? rec.label.trim()
              : typeof rec.name === 'string' ? rec.name.trim()
                : typeof rec.display_name === 'string' ? rec.display_name.trim()
                  : humanizeModelId(id)
            return [{ id, label }]
          }
          return []
        }))
      }
      if (value && typeof value === 'object') {
        const rec = value as Record<string, unknown>
        if (rec.is_error === true) return []
        if (Array.isArray(rec.models)) {
          return parseClaudeModelsStdout(JSON.stringify(rec.models))
        }
      }
    } catch {
      // fall through to line parsers
    }
  }

  const fromCursorStyle = parseCursorModelsStdout(stdout)
  if (fromCursorStyle.length) return fromCursorStyle

  const models: AgentModelOption[] = []
  // Aliases citados en --help: 'fable', 'opus', or 'sonnet'
  for (const match of stdout.matchAll(/'([a-z0-9][a-z0-9._-]*)'/gi)) {
    const id = match[1]
    if (id.length < 2) continue
    if (/^(e\.g|eg|or|and|the)$/i.test(id)) continue
    models.push({ id, label: humanizeModelId(id) })
  }
  // Full names: claude-fable-5
  for (const match of stdout.matchAll(/\b(claude-[a-z0-9][a-z0-9._-]*)\b/gi)) {
    models.push({ id: match[1], label: humanizeModelId(match[1]) })
  }
  return dedupeModels(models)
}

/**
 * Copilot: tabla markdown de `/models`, backticks, o ejemplo `--model gpt-5.4` en help.
 */
export function parseCopilotModelsStdout(stdout: string): AgentModelOption[] {
  const models: AgentModelOption[] = []

  // | **Label** | `id` | ...
  for (const match of stdout.matchAll(
    /\|\s*\*\*([^*]+)\*\*\s*\|\s*`([A-Za-z0-9._:-]+)`\s*\|/g,
  )) {
    models.push({ id: match[2], label: match[1].trim() })
  }

  for (const match of stdout.matchAll(/`((?:claude|gpt|gemini|mai|o\d|auto)[A-Za-z0-9._-]*)`/g)) {
    models.push({ id: match[1], label: humanizeModelId(match[1]) })
  }

  for (const match of stdout.matchAll(/--model[= ]([A-Za-z0-9._:-]+)/g)) {
    models.push({ id: match[1], label: humanizeModelId(match[1]) })
  }

  if (/\bauto\b/i.test(stdout) && !models.some(m => m.id === 'auto')) {
    models.unshift({ id: 'auto', label: 'Auto' })
  }

  return dedupeModels(models)
}

export function parseModelsStdout(
  provider: AgentCliProvider,
  stdout: string,
): AgentModelOption[] {
  if (provider === 'claude') return parseClaudeModelsStdout(stdout)
  if (provider === 'copilot') return parseCopilotModelsStdout(stdout)
  return parseCursorModelsStdout(stdout)
}

function commandAndListArgs(
  provider: AgentCliProvider,
  config: AppConfig,
): { command: string; args: string[] } {
  const command = agentCliCommand(config.agentCliCommands, provider)
  // Subcomando real: `claude models` (falla con auth → fallback).
  if (provider === 'claude') return { command, args: ['models'] }
  // Copilot no tiene `--list-models`; la ayuda documenta `--model` (y a veces IDs).
  if (provider === 'copilot') return { command, args: ['help'] }
  return { command, args: ['--list-models'] }
}

export function runCliCapture(
  command: string,
  args: string[],
  timeoutMs: number,
): Promise<{ stdout: string; stderr: string; code: number | null; timedOut: boolean }> {
  return new Promise(resolve => {
    let stdout = ''
    let stderr = ''
    let settled = false
    let timedOut = false
    let proc: ReturnType<typeof crossSpawn>
    try {
      proc = crossSpawn(resolveCliExecutable(command), args, {
        stdio: ['ignore', 'pipe', 'pipe'],
        env: process.env,
        windowsHide: true,
      })
    } catch (error) {
      resolve({
        stdout: '',
        stderr: error instanceof Error ? error.message : String(error),
        code: 1,
        timedOut: false,
      })
      return
    }

    const finish = (code: number | null): void => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      resolve({ stdout, stderr, code, timedOut })
    }

    const timer = setTimeout(() => {
      timedOut = true
      try { proc.kill('SIGTERM') } catch { /* ignore */ }
      setTimeout(() => {
        try { proc.kill('SIGKILL') } catch { /* ignore */ }
      }, 500)
      finish(null)
    }, timeoutMs)

    proc.stdout?.setEncoding('utf8')
    proc.stderr?.setEncoding('utf8')
    proc.stdout?.on('data', (chunk: string) => { stdout += chunk })
    proc.stderr?.on('data', (chunk: string) => { stderr += chunk })
    proc.on('error', error => {
      stderr = stderr || error.message
      finish(1)
    })
    proc.on('close', code => finish(code))
  })
}

function pushCopilotCacheCandidates(candidates: string[], cacheRoot: string): void {
  if (!existsSync(cacheRoot)) return
  try {
    const versions = readdirSync(cacheRoot).sort().reverse()
    for (const version of versions.slice(0, 3)) {
      candidates.push(join(cacheRoot, version, 'app.js'))
    }
  } catch {
    /* ignore */
  }
}

/**
 * Catálogo embebido en el paquete npm de Copilot (cuando `help` no lista IDs).
 * No inventa IDs: lee claves del binario/paquete instalado junto al comando.
 */
export function extractCopilotModelsFromPackage(command: string): AgentModelOption[] {
  const candidates: string[] = []
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const resolved = require.resolve('@github/copilot/package.json')
    candidates.push(join(dirname(resolved), 'app.js'))
  } catch {
    /* optional */
  }

  const absolute = resolveCommandAbsolutePath(command)
  if (absolute) {
    const dir = dirname(absolute)
    candidates.push(
      join(dir, '../lib/node_modules/@github/copilot/app.js'),
      join(dir, 'app.js'),
    )
    if (basename(absolute) === 'npm-loader.js') {
      candidates.push(join(dir, 'app.js'))
    }
  } else if (command.includes('/') || command.includes('\\')) {
    const dir = dirname(command)
    candidates.push(
      join(dir, '../lib/node_modules/@github/copilot/app.js'),
      join(dir, 'app.js'),
    )
  }

  const home = process.env.HOME || ''
  const pkgRoot = join(home, 'Library/Caches/copilot/pkg')
  const platformArch = `${process.platform === 'win32' ? 'win32' : process.platform}-${process.arch}`
  pushCopilotCacheCandidates(candidates, join(pkgRoot, platformArch))
  pushCopilotCacheCandidates(candidates, join(pkgRoot, 'universal'))

  const needle = '{"sweagent-capi":{'
  for (const appJs of candidates) {
    if (!existsSync(appJs)) continue
    try {
      const source = readFileSync(appJs, 'utf8')
      const braceStart = source.indexOf(needle)
      if (braceStart < 0) continue
      let depth = 0
      let end = -1
      for (let i = braceStart; i < source.length && i < braceStart + 80_000; i += 1) {
        const ch = source[i]
        if (ch === '{') depth += 1
        else if (ch === '}') {
          depth -= 1
          if (depth === 0) {
            end = i
            break
          }
        }
      }
      if (end < 0) continue
      const block = source.slice(braceStart, end + 1)
      const ids = [...block.matchAll(/"((?:claude|gpt|gemini|mai)[^"]+)"\s*:/g)]
        .map(match => match[1])
        .filter(id => !id.includes('internal') && !id.endsWith('-picker'))
      const models: AgentModelOption[] = [
        { id: 'auto', label: 'Auto' },
        ...ids.map(id => ({ id, label: humanizeModelId(id) })),
      ]
      const deduped = dedupeModels(models)
      if (deduped.length > 1) return deduped
    } catch {
      /* try next */
    }
  }
  return []
}

function looksLikeCliHelpText(text: string): boolean {
  return /\bUsage:\b/i.test(text) || /\bOptions:\b/i.test(text)
}

function copilotIncompleteCatalogError(
  result: { stdout: string; stderr: string; code: number | null; timedOut: boolean },
  command: string,
): string {
  if (result.timedOut) {
    return `Tiempo agotado al listar modelos (${command}).`
  }
  const stderr = result.stderr.trim()
  const realFailure = result.code !== 0 && result.code !== null
    && stderr.length > 0
    && stderr.length <= 280
    && !looksLikeCliHelpText(stderr)
  if (realFailure) return stderr.slice(0, 280)
  return 'No se pudo obtener el catálogo completo de modelos de Copilot; se usa la lista estática.'
}

function fallbackResult(
  provider: AgentCliProvider,
  error: string,
): AgentCliModelsResult {
  return {
    models: modelsForProvider(provider),
    source: 'fallback',
    error,
  }
}

/** Lista modelos del provider con timeout corto; fallback si el CLI falla. */
export async function listAgentCliModels(
  provider: AgentCliProvider,
  config: AppConfig,
): Promise<AgentCliModelsResult> {
  if (provider !== 'claude' && provider !== 'cursor' && provider !== 'copilot') {
    return fallbackResult('claude', 'Proveedor no válido.')
  }

  const { command, args } = commandAndListArgs(provider, config)
  if (!command) {
    return fallbackResult(provider, 'Comando CLI no configurado.')
  }

  const result = await runCliCapture(command, args, LIST_TIMEOUT_MS)
  const combined = [result.stdout, result.stderr].filter(Boolean).join('\n')
  let models = parseModelsStdout(provider, combined)

  // Copilot `help` suele devolver un parse parcial; umbral = 8 (fallback tiene 20).
  if (provider === 'copilot' && models.length < 8) {
    const fromPackage = extractCopilotModelsFromPackage(command)
    if (fromPackage.length > models.length) models = fromPackage
  }

  if (provider === 'copilot' && models.length < 8) {
    return fallbackResult(provider, copilotIncompleteCatalogError(result, command))
  }

  if (models.length > 0) {
    return {
      models,
      source: 'cli',
      ...(result.timedOut
        ? { error: 'El listado del CLI superó el tiempo límite; se usó lo parseado.' }
        : {}),
    }
  }

  if (result.timedOut) {
    return fallbackResult(provider, `Tiempo agotado al listar modelos (${command}).`)
  }

  const detail = (result.stderr || result.stdout).trim().slice(0, 280)
    || `El CLI no devolvió modelos (exit ${result.code ?? '?'}).`
  return fallbackResult(provider, detail)
}
