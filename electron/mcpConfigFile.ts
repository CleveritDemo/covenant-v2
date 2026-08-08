import { existsSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import type { AgentCliProvider } from '../src/shared/agentCliProviders'

/**
 * `mcp.json` efímero con solo los servidores permitidos para un agente.
 *
 * Va a un temporal del proceso, **nunca** a la carpeta del proyecto: esa se
 * commitea al repo del equipo y esto es config de un spawn concreto.
 */
export function writeScopedMcpConfig(
  allowed: readonly string[],
  source: unknown,
  tmpDir: string,
): string | null {
  if (!allowed.length) return null

  const all = (source && typeof source === 'object'
    ? (source as Record<string, unknown>).mcpServers
    : undefined)
  const servers = all && typeof all === 'object' ? all as Record<string, unknown> : {}

  const scoped: Record<string, unknown> = {}
  for (const id of allowed) {
    if (id in servers) scoped[id] = servers[id]
  }

  const path = join(tmpDir, 'mcp.json')
  writeFileSync(path, JSON.stringify({ mcpServers: scoped }, null, 2), 'utf8')
  return path
}

/**
 * Lee `<cwd>/.mcp.json`: el archivo estándar del harness con la config de
 * servidores MCP del proyecto. Vive en la raíz del proyecto, no bajo
 * `.gravity/` (eso es la carpeta propia de Gravity, otra cosa).
 * Si no existe o está corrupto, devuelve `null`: sin fuente, no hay nada
 * que acotar y el turno arranca sin MCPs en vez de fallar.
 */
export function readProjectMcpConfig(cwd: string): unknown {
  return readMcpConfigFile(join(cwd, '.mcp.json'))
}

/**
 * Config MCP propia del CLI de Copilot (`~/.copilot/mcp-config.json`). Copilot
 * no lee el `.mcp.json` del proyecto, y su acotado es una denylist: hay que
 * saber qué hay configurado para poder apagar lo que no está permitido.
 */
export function readCopilotMcpConfig(home: string): unknown {
  return readMcpConfigFile(join(home, '.copilot', 'mcp-config.json'))
}

/**
 * De dónde salen los servidores de cada CLI. Copilot y Gemini leen su propia
 * config de usuario; el resto, el `.mcp.json` del proyecto. Un archivo ausente
 * devuelve `null` y la lista sale vacía — el modal lo dice, no falla.
 */
export function readMcpConfigFor(
  provider: AgentCliProvider,
  cwd: string,
  home: string,
): unknown {
  if (provider === 'copilot') return readCopilotMcpConfig(home)
  if (provider === 'gemini') return readMcpConfigFile(join(home, '.gemini', 'settings.json'))
  return readProjectMcpConfig(cwd)
}

function readMcpConfigFile(path: string): unknown {
  if (!existsSync(path)) return null
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as unknown
  } catch {
    return null
  }
}

/** Nombres de servidor de un `mcpServers`, o vacío si la fuente no sirve. */
export function mcpServerNames(source: unknown): string[] {
  const all = source && typeof source === 'object'
    ? (source as Record<string, unknown>).mcpServers
    : undefined
  return all && typeof all === 'object' && !Array.isArray(all) ? Object.keys(all) : []
}

/**
 * Denylist derivada: lo configurado menos lo permitido. Vacía cuando no hay
 * allowlist — sin acotado pedido no se apaga nada.
 */
export function mcpServersToDisable(
  configured: readonly string[],
  allowed: readonly string[],
): string[] {
  if (!allowed.length) return []
  const keep = new Set(allowed)
  return configured.filter(name => !keep.has(name))
}
