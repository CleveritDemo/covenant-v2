/**
 * Validación del texto crudo de la config MCP antes de escribirla.
 *
 * Vive en shared porque la usan los dos lados y por motivos distintos: el
 * renderer para avisar mientras se escribe, y el main como frontera de
 * confianza — un JSON roto en `.mcp.json` deja al CLI sin servidores y el
 * renderer nunca es autoridad sobre lo que se escribe en disco.
 */

export type McpConfigTextCheck =
  | { ok: true; servers: string[] }
  | { ok: false; reason: 'empty' | 'invalid-json' | 'not-object' | 'servers-not-object'; detail?: string }

/** Tope defensivo: un `.mcp.json` real son KB, no MB. */
export const MCP_CONFIG_MAX_BYTES = 512 * 1024

export function validateMcpConfigText(raw: string): McpConfigTextCheck {
  const text = typeof raw === 'string' ? raw.trim() : ''
  if (!text) return { ok: false, reason: 'empty' }

  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch (error) {
    return {
      ok: false,
      reason: 'invalid-json',
      detail: error instanceof Error ? error.message : undefined,
    }
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { ok: false, reason: 'not-object' }
  }

  const servers = (parsed as Record<string, unknown>).mcpServers
  // Ausente es válido: gemini guarda `settings.json` con más cosas dentro y un
  // archivo sin servidores todavía es una config legítima.
  if (servers === undefined) return { ok: true, servers: [] }
  if (!servers || typeof servers !== 'object' || Array.isArray(servers)) {
    return { ok: false, reason: 'servers-not-object' }
  }

  return { ok: true, servers: Object.keys(servers as Record<string, unknown>) }
}
