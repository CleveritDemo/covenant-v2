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
