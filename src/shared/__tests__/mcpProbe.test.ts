import { describe, expect, it } from 'vitest'
import {
  ATLASSIAN_MCP_AUTH_URL,
  classifyMcpHttpProbe,
  isLegacyAtlassianMcpUrl,
  mcpConnectHint,
  mcpServerAuthHeaders,
  mcpServerRemoteUrl,
} from '../mcpProbe'

describe('mcpServerRemoteUrl', () => {
  it('saca la url o null', () => {
    expect(mcpServerRemoteUrl({ url: ' https://mcp.atlassian.com/v1/sse ' }))
      .toBe('https://mcp.atlassian.com/v1/sse')
    expect(mcpServerRemoteUrl({ command: 'npx' })).toBeNull()
    expect(mcpServerRemoteUrl(null)).toBeNull()
  })
})

describe('mcpServerAuthHeaders', () => {
  it('solo conserva headers string', () => {
    expect(mcpServerAuthHeaders({
      headers: { Authorization: 'Bearer x', n: 1 },
    })).toEqual({ Authorization: 'Bearer x' })
    expect(mcpServerAuthHeaders({ command: 'x' })).toEqual({})
  })
})

describe('classifyMcpHttpProbe', () => {
  it('marca 401/403 como needsAuth', () => {
    expect(classifyMcpHttpProbe({ status: 401 })).toBe('needsAuth')
    expect(classifyMcpHttpProbe({
      status: 403,
      wwwAuthenticate: 'Bearer realm="OAuth"',
    })).toBe('needsAuth')
  })

  it('trata 2xx–4xx no-auth como ok (host vivo)', () => {
    expect(classifyMcpHttpProbe({ status: 200 })).toBe('ok')
    expect(classifyMcpHttpProbe({ status: 405 })).toBe('ok')
  })

  it('marca fallos de red / 5xx como unreachable', () => {
    expect(classifyMcpHttpProbe({ status: 0 })).toBe('unreachable')
    expect(classifyMcpHttpProbe({ status: 502 })).toBe('unreachable')
  })
})

describe('isLegacyAtlassianMcpUrl', () => {
  it('detecta el SSE legacy', () => {
    expect(isLegacyAtlassianMcpUrl('https://mcp.atlassian.com/v1/sse')).toBe(true)
    expect(isLegacyAtlassianMcpUrl(ATLASSIAN_MCP_AUTH_URL)).toBe(false)
  })
})

describe('mcpConnectHint', () => {
  it('incluye migración cuando la URL es el SSE legacy', () => {
    const hint = mcpConnectHint({
      provider: 'GitHub Copilot',
      serverName: 'jira',
      url: 'https://mcp.atlassian.com/v1/sse',
    })
    expect(hint).toContain('copilot')
    expect(hint).toContain(ATLASSIAN_MCP_AUTH_URL)
    expect(hint).toContain('jira')
  })
})
