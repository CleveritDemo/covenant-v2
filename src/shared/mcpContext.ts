/**
 * Cuerpo del contexto `mcp`: un `## <servidor>` por entrada de `.mcp.json`.
 *
 * Vive en `src/shared/` porque los dos lados lo necesitan con las mismas cifras:
 * `electron/` para materializar el `.md` y el renderer para el presupuesto del
 * modal. Los encabezados `##` son las claves de sección que ve el modelo, así
 * que el nombre del servidor es lo que puede pedir por `need-sections`.
 *
 * Nunca escribe valores de `env` ni de `headers`: ahí viven los tokens, y este
 * cuerpo acaba en un `.md` del repo y en el prompt. Solo los nombres, que es lo
 * que el agente necesita saber para entender qué le falta.
 */

import type { AgentCliProvider } from './agentCliProviders'

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null

function transportOf(entry: Record<string, unknown>): string {
  for (const field of ['type', 'transport'] as const) {
    const value = entry[field]
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  if (typeof entry.url === 'string') return 'http'
  if (typeof entry.command === 'string') return 'stdio'
  return 'unknown'
}

export interface McpServerSummary {
  name: string
  /** `stdio` | `http` | lo que declare el archivo; `unknown` si no se deduce. */
  transport: string
}

/**
 * Servidores configurados, para el selector de Capabilities. Misma lectura que
 * el contexto `mcp`, así que la lista que marca el usuario y la que ve el
 * modelo no pueden divergir.
 */
export function mcpServerSummaries(source: unknown): McpServerSummary[] {
  const servers = asRecord(asRecord(source)?.mcpServers)
  if (!servers) return []
  return Object.keys(servers).map(name => ({
    name,
    transport: transportOf(asRecord(servers[name]) ?? {}),
  }))
}

function serverSection(name: string, raw: unknown): string {
  const entry = asRecord(raw) ?? {}
  const lines = [`## ${name}`, `- transport: ${transportOf(entry)}`]

  if (typeof entry.url === 'string' && entry.url.trim()) {
    lines.push(`- url: ${entry.url.trim()}`)
  }
  if (typeof entry.command === 'string' && entry.command.trim()) {
    const args = Array.isArray(entry.args)
      ? entry.args.filter((arg): arg is string => typeof arg === 'string')
      : []
    lines.push(`- command: \`${[entry.command.trim(), ...args].join(' ')}\``)
  }
  // Solo los nombres: el valor es el secreto.
  for (const field of ['env', 'headers'] as const) {
    const names = Object.keys(asRecord(entry[field]) ?? {})
    if (names.length) lines.push(`- ${field}: ${names.join(', ')} (values omitted)`)
  }

  return lines.join('\n')
}

export function formatMcpServers(source: unknown): string {
  const servers = asRecord(asRecord(source)?.mcpServers)
  const names = servers ? Object.keys(servers) : []
  if (!names.length) return '(no MCP servers configured in .mcp.json)'
  return names.map(name => serverSection(name, servers![name])).join('\n\n')
}

export interface McpServersListRequest {
  provider: AgentCliProvider
  /** Proyecto del pane; solo lo usan los CLIs que leen `.mcp.json`. */
  cwd?: string
}

/**
 * Archivo del que sale la lista, para poder decirlo siempre y no solo cuando
 * está vacía. Vive aquí y no en `electron/` porque lo enseña el modal.
 */
export function mcpConfigLabelFor(provider: AgentCliProvider): string {
  if (provider === 'copilot') return '~/.copilot/mcp-config.json'
  if (provider === 'gemini') return '~/.gemini/settings.json'
  return '.mcp.json'
}

/**
 * Si el CLI lee el `.mcp.json` del proyecto. Copilot y Gemini no: usan su propia
 * config de usuario, así que los servidores del repo les son invisibles. Esa
 * asimetría hay que decirla en la UI o se lee como «este agente no puede usar
 * MCP», que es falso.
 */
export function providerUsesProjectMcpConfig(provider: AgentCliProvider): boolean {
  return provider !== 'copilot' && provider !== 'gemini'
}

/**
 * Cómo acota cada CLI, que cambia lo que significa marcar casillas:
 * - `allowlist`: solo existe lo marcado (claude, cursor).
 * - `names`: se pasan los permitidos por nombre (gemini).
 * - `denylist`: se apaga lo no marcado, incluidos los integrados (copilot). No
 *   es un sandbox: lo que aparezca en la config después no queda cubierto.
 */
export function mcpScopeModeFor(provider: AgentCliProvider): 'allowlist' | 'denylist' | 'names' {
  if (provider === 'copilot') return 'denylist'
  if (provider === 'gemini') return 'names'
  return 'allowlist'
}

export interface McpServersListResult {
  servers: McpServerSummary[]
  /** Archivo del que salió la lista. */
  file: string
  /** Si ese archivo existe: cambia «ábrelo» por «créalo». */
  fileExists: boolean
  /** Nombres del `.mcp.json` del proyecto que este CLI no va a leer. */
  unreadProjectServers: string[]
}
