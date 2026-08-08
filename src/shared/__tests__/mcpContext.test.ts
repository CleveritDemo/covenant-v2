import { describe, expect, it } from 'vitest'
import { formatMcpServers } from '../mcpContext'
import { markdownSections } from '../contextSections'

describe('formatMcpServers', () => {
  it('una sección por servidor, con el comando completo', () => {
    const body = formatMcpServers({
      mcpServers: {
        jira: { command: 'npx', args: ['-y', 'mcp-remote', 'https://mcp.atlassian.com/v1/sse'] },
        context7: { type: 'http', url: 'https://mcp.context7.com/mcp' },
      },
    })
    expect(markdownSections(body).map(section => section.key)).toEqual(['jira', 'context7'])
    expect(body).toContain('- command: `npx -y mcp-remote https://mcp.atlassian.com/v1/sse`')
    expect(body).toContain('- transport: http')
    expect(body).toContain('- url: https://mcp.context7.com/mcp')
  })

  it('infiere el transporte cuando no viene declarado', () => {
    expect(formatMcpServers({ mcpServers: { local: { command: 'node' } } }))
      .toContain('- transport: stdio')
    expect(formatMcpServers({ mcpServers: { remoto: { url: 'https://x/mcp' } } }))
      .toContain('- transport: http')
  })

  it('nunca escribe valores de env ni de headers', () => {
    const body = formatMcpServers({
      mcpServers: {
        jira: {
          command: 'node',
          env: { ATLASSIAN_TOKEN: 'super-secreto' },
          headers: { Authorization: 'Bearer super-secreto' },
        },
      },
    })
    expect(body).not.toContain('super-secreto')
    expect(body).toContain('- env: ATLASSIAN_TOKEN (values omitted)')
    expect(body).toContain('- headers: Authorization (values omitted)')
  })

  it('sin fuente utilizable devuelve el estado vacío, no una excepción', () => {
    for (const source of [null, undefined, 'nope', {}, { mcpServers: {} }, { mcpServers: [] }]) {
      expect(formatMcpServers(source)).toBe('(no MCP servers configured in .mcp.json)')
    }
  })
})
