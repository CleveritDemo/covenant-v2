import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'
import type { AgentCliProvider } from '../src/shared/agentCliProviders'
import { MCP_CONFIG_MAX_BYTES, validateMcpConfigText } from '../src/shared/mcpConfigText'

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
  return readMcpConfigFile(mcpConfigPathFor(provider, cwd, home))
}

/**
 * Ruta absoluta del archivo del que sale la config de cada CLI. Única fuente de
 * verdad: la usan la lectura, el «existe / no existe» del panel y el botón que
 * lo crea, así que no pueden apuntar a sitios distintos.
 */
export function mcpConfigPathFor(
  provider: AgentCliProvider,
  cwd: string,
  home: string,
): string {
  if (provider === 'copilot') return join(home, '.copilot', 'mcp-config.json')
  if (provider === 'gemini') return join(home, '.gemini', 'settings.json')
  return join(cwd, '.mcp.json')
}

/**
 * Crea el archivo con un `mcpServers` vacío si no está, y devuelve su ruta.
 * Nunca toca uno existente: la gracia del botón es salir del callejón «el
 * archivo no existe», no reescribir la configuración de nadie.
 */
export function ensureMcpConfigFile(path: string): { created: boolean } {
  if (existsSync(path)) return { created: false }
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, `${JSON.stringify({ mcpServers: {} }, null, 2)}\n`, 'utf-8')
  return { created: true }
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

/** Texto crudo del archivo, o cadena vacía si todavía no existe. */
export function readMcpConfigText(path: string): { text: string; exists: boolean } {
  if (!existsSync(path)) return { text: '', exists: false }
  try {
    return { text: readFileSync(path, 'utf8'), exists: true }
  } catch {
    return { text: '', exists: false }
  }
}

/**
 * Escritura atómica del archivo tal cual lo escribió la persona: se conserva su
 * formato (comentarios no, es JSON, pero sí el orden y la indentación) en vez
 * de reserializar. Valida aquí también: el handler ya filtra, pero esta es la
 * frontera real de disco y no debe confiar en el caller.
 */
export function writeMcpConfigText(path: string, text: string): void {
  if (Buffer.byteLength(text, 'utf8') > MCP_CONFIG_MAX_BYTES) {
    throw new Error('too-large')
  }
  const check = validateMcpConfigText(text)
  if (!check.ok) throw new Error(check.reason)

  mkdirSync(dirname(path), { recursive: true })
  const tmp = `${path}.tmp`
  writeFileSync(tmp, text.endsWith('\n') ? text : `${text}\n`, 'utf-8')
  renameSync(tmp, path)
}
