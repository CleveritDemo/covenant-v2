/**
 * Probe HTTP corto a servidores MCP remotos y detección de OAuth cacheado
 * de Copilot. El clasificador puro vive en `src/shared/mcpProbe.ts`.
 */

import { existsSync, readdirSync, readFileSync } from 'fs'
import { join } from 'path'
import { httpFetch } from './httpFetch'
import type { McpServerSummary } from '../src/shared/mcpContext'
import {
  classifyMcpHttpProbe,
  mcpServerAuthHeaders,
  mcpServerRemoteUrl,
  type McpProbeStatus,
} from '../src/shared/mcpProbe'
import { mcpServerDefinition } from '../src/shared/mcpContext'

const PROBE_TIMEOUT_MS = 2000

/**
 * Si Copilot ya completó OAuth para esta URL, deja rastro en
 * `~/.copilot/mcp-oauth-config/`. Sin eso, un probe sin token siempre vería
 * 401 aunque el CLI sí pudiera conectar.
 */
export function copilotMcpOAuthCached(home: string, serverUrl: string): boolean {
  const dir = join(home, '.copilot', 'mcp-oauth-config')
  if (!existsSync(dir)) return false
  let files: string[]
  try {
    files = readdirSync(dir)
  } catch {
    return false
  }
  const needle = serverUrl.replace(/\/+$/, '')
  for (const file of files) {
    if (!file.endsWith('.json')) continue
    try {
      const raw = readFileSync(join(dir, file), 'utf8')
      if (raw.includes(needle) || raw.includes(serverUrl)) return true
    } catch {
      // ignore unreadable entries
    }
  }
  return false
}

async function probeUrl(
  url: string,
  headers: Record<string, string>,
): Promise<McpProbeStatus> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS)
  try {
    const response = await httpFetch(url, {
      method: 'GET',
      headers: {
        Accept: 'text/event-stream, application/json, */*',
        ...headers,
      },
      redirect: 'manual',
      signal: controller.signal,
    })
    return classifyMcpHttpProbe({
      status: response.status,
      wwwAuthenticate: response.headers.get('www-authenticate'),
    })
  } catch {
    return 'unreachable'
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Adjunta `liveness` a cada servidor remoto. Stdio se queda sin liveness
 * (la estantería lo trata como ready).
 */
export async function withMcpServerLiveness(
  servers: readonly McpServerSummary[],
  source: unknown,
  home: string,
): Promise<McpServerSummary[]> {
  return Promise.all(servers.map(async server => {
    const definition = mcpServerDefinition(source, server.name)
    const url = server.url ?? mcpServerRemoteUrl(definition)
    if (!url) return server

    if (copilotMcpOAuthCached(home, url)) {
      return { ...server, url, liveness: 'ok' as const }
    }

    const headers = mcpServerAuthHeaders(definition)
    const liveness = await probeUrl(url, headers)
    return { ...server, url, liveness }
  }))
}
