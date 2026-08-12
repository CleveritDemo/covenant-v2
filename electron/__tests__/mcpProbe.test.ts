import { describe, expect, it } from 'vitest'
import { mkdirSync, mkdtempSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { copilotMcpOAuthCached } from '../mcpProbe'

describe('copilotMcpOAuthCached', () => {
  it('false si no hay carpeta oauth', () => {
    const home = mkdtempSync(join(tmpdir(), 'gravity-oauth-'))
    expect(copilotMcpOAuthCached(home, 'https://mcp.atlassian.com/v1/sse')).toBe(false)
  })

  it('true si algún json menciona la url', () => {
    const home = mkdtempSync(join(tmpdir(), 'gravity-oauth-'))
    const dir = join(home, '.copilot', 'mcp-oauth-config')
    mkdirSync(dir, { recursive: true })
    writeFileSync(
      join(dir, 'abc.json'),
      JSON.stringify({ serverUrl: 'https://mcp.atlassian.com/v1/sse' }),
      'utf8',
    )
    expect(copilotMcpOAuthCached(home, 'https://mcp.atlassian.com/v1/sse')).toBe(true)
    expect(copilotMcpOAuthCached(home, 'https://other.example/mcp')).toBe(false)
  })
})
