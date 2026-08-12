/**
 * Clasificación pura del probe HTTP a un MCP remoto.
 *
 * El main hace el fetch; aquí solo se interpreta status/cabeceras para que el
 * panel no diga «lista» cuando Atlassian (u otro OAuth) responde 401.
 */

export type McpProbeStatus = 'ok' | 'needsAuth' | 'unreachable'

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null

/** URL remota de una entrada `mcpServers`, o null si es stdio / no tiene. */
export function mcpServerRemoteUrl(definition: unknown): string | null {
  const entry = asRecord(definition)
  if (!entry) return null
  const url = entry.url
  if (typeof url !== 'string' || !url.trim()) return null
  return url.trim()
}

/** Si la config ya lleva Authorization (token estático), el probe puede usarlo. */
export function mcpServerAuthHeaders(definition: unknown): Record<string, string> {
  const headers = asRecord(asRecord(definition)?.headers)
  if (!headers) return {}
  const out: Record<string, string> = {}
  for (const [key, value] of Object.entries(headers)) {
    if (typeof value === 'string' && value.trim()) out[key] = value.trim()
  }
  return out
}

/**
 * Endpoint SSE legacy de Atlassian Rovo MCP. Copilot autentica mejor con el
 * HTTP moderno (`…/v1/mcp/authv2`).
 */
export function isLegacyAtlassianMcpUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    return parsed.hostname === 'mcp.atlassian.com'
      && /\/v1\/sse\/?$/i.test(parsed.pathname)
  } catch {
    return false
  }
}

export const ATLASSIAN_MCP_AUTH_URL = 'https://mcp.atlassian.com/v1/mcp/authv2'

/**
 * Interpreta la respuesta del probe. 401/403 → needsAuth aunque no venga
 * WWW-Authenticate (Atlassian a veces solo manda el body JSON).
 */
export function classifyMcpHttpProbe(input: {
  status: number
  wwwAuthenticate?: string | null
}): McpProbeStatus {
  const status = input.status
  if (!Number.isFinite(status) || status <= 0) return 'unreachable'
  if (status === 401 || status === 403) return 'needsAuth'
  // 2xx–3xx: el transporte responde. 4xx distinto de auth: el host está vivo
  // (p. ej. 404/405 en HEAD); no es «hay que conectar».
  if (status >= 200 && status < 500) return 'ok'
  return 'unreachable'
}

/**
 * Texto que el usuario puede pegar en una sesión interactiva de Copilot para
 * conectar un MCP remoto que pide OAuth.
 */
export function mcpConnectHint(input: {
  provider: string
  serverName: string
  url?: string | null
}): string {
  const lines = [
    `Connect MCP "${input.serverName}" for ${input.provider}.`,
    '1. In a terminal, start an interactive session: copilot',
    '2. When the CLI prompts for authentication, complete the browser OAuth flow.',
    '3. Ask once about a Jira issue to confirm the tools loaded, then return here.',
  ]
  if (input.url && isLegacyAtlassianMcpUrl(input.url)) {
    lines.push(
      `4. Optional: in ~/.copilot/mcp-config.json change the URL from the legacy SSE`,
      `   (${input.url}) to ${ATLASSIAN_MCP_AUTH_URL} with "type": "http".`,
    )
  }
  return lines.join('\n')
}
