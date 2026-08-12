import { describe, expect, it } from 'vitest'
import {
  buildMcpToolRows,
  mcpServerDefinition,
  mcpsNeedingAuth,
  withMcpServer,
} from '../mcpContext'

const projectConfig = {
  mcpServers: {
    jira: { command: 'npx', args: ['-y', 'jira-mcp'] },
    context7: { url: 'https://mcp.context7.com' },
  },
}

describe('mcpServerDefinition', () => {
  it('saca la entrada cruda por nombre', () => {
    expect(mcpServerDefinition(projectConfig, 'jira')).toEqual({
      command: 'npx',
      args: ['-y', 'jira-mcp'],
    })
    expect(mcpServerDefinition(projectConfig, 'nope')).toBeNull()
    expect(mcpServerDefinition(null, 'jira')).toBeNull()
  })
})

describe('withMcpServer', () => {
  it('añade el servidor conservando los demás', () => {
    const { config, added } = withMcpServer(
      { mcpServers: { chrome: { command: 'chrome-mcp' } } },
      'jira',
      mcpServerDefinition(projectConfig, 'jira'),
    )
    expect(added).toBe(true)
    expect(Object.keys(config.mcpServers)).toEqual(['chrome', 'jira'])
  })

  it('crea el mapa si el archivo estaba vacío y conserva otras claves', () => {
    const { config, added } = withMcpServer({ version: 2 }, 'jira', { command: 'x' })
    expect(added).toBe(true)
    expect(config).toEqual({ version: 2, mcpServers: { jira: { command: 'x' } } })
  })

  it('nunca pisa una entrada existente', () => {
    const target = { mcpServers: { jira: { command: 'mío', env: { TOKEN: 'secreto' } } } }
    const { config, added } = withMcpServer(target, 'jira', { command: 'otro' })
    expect(added).toBe(false)
    expect(config.mcpServers.jira).toEqual({ command: 'mío', env: { TOKEN: 'secreto' } })
  })
})

describe('buildMcpToolRows', () => {
  it('ordena: configurados, luego los del proyecto que el CLI ignora, luego los perdidos', () => {
    const rows = buildMcpToolRows({
      servers: [{ name: 'chrome', transport: 'stdio' }],
      unreadProjectServers: ['jira', 'chrome'],
      allowed: ['chrome', 'viejo'],
    })
    expect(rows).toEqual([
      { name: 'chrome', transport: 'stdio', state: 'ready' },
      { name: 'jira', transport: '', state: 'project' },
      { name: 'viejo', transport: '', state: 'missing' },
    ])
  })

  it('propaga needsAuth / unreachable del probe y la url', () => {
    const rows = buildMcpToolRows({
      servers: [
        { name: 'jira', transport: 'sse', url: 'https://mcp.atlassian.com/v1/sse', liveness: 'needsAuth' },
        { name: 'down', transport: 'http', liveness: 'unreachable' },
      ],
      unreadProjectServers: [],
      allowed: ['jira'],
    })
    expect(rows).toEqual([
      {
        name: 'jira',
        transport: 'sse',
        state: 'needsAuth',
        url: 'https://mcp.atlassian.com/v1/sse',
      },
      { name: 'down', transport: 'http', state: 'unreachable' },
    ])
  })
})

describe('mcpsNeedingAuth', () => {
  it('solo devuelve permitidos con liveness needsAuth', () => {
    expect(mcpsNeedingAuth(
      [
        { name: 'jira', transport: 'sse', liveness: 'needsAuth' },
        { name: 'ok', transport: 'stdio', liveness: 'ok' },
        { name: 'other', transport: 'http', liveness: 'needsAuth' },
      ],
      ['jira', 'ok'],
    )).toEqual(['jira'])
    expect(mcpsNeedingAuth([], ['jira'])).toEqual([])
  })
})
