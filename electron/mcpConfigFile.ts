import { existsSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'

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
  const path = join(cwd, '.mcp.json')
  if (!existsSync(path)) return null
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as unknown
  } catch {
    return null
  }
}
