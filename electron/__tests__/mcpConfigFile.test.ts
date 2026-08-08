import { describe, expect, it } from 'vitest'
import { mkdtempSync, readFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { writeScopedMcpConfig } from '../mcpConfigFile'

const source = {
  mcpServers: {
    jira: { command: 'jira-mcp' },
    figma: { command: 'figma-mcp' },
    secreto: { command: 'otro' },
  },
}

describe('writeScopedMcpConfig', () => {
  it('escribe solo los servidores permitidos', () => {
    const dir = mkdtempSync(join(tmpdir(), 'gravity-mcp-'))
    const path = writeScopedMcpConfig(['jira'], source, dir)
    expect(path).toBeTruthy()
    const written = JSON.parse(readFileSync(path!, 'utf8')) as Record<string, unknown>
    expect(written).toEqual({ mcpServers: { jira: { command: 'jira-mcp' } } })
  })

  it('ignora ids permitidos que no existen en la fuente', () => {
    const dir = mkdtempSync(join(tmpdir(), 'gravity-mcp-'))
    const path = writeScopedMcpConfig(['jira', 'inexistente'], source, dir)
    const written = JSON.parse(readFileSync(path!, 'utf8')) as { mcpServers: Record<string, unknown> }
    expect(Object.keys(written.mcpServers)).toEqual(['jira'])
  })

  it('sin permitidos devuelve null: no hay nada que acotar', () => {
    const dir = mkdtempSync(join(tmpdir(), 'gravity-mcp-'))
    expect(writeScopedMcpConfig([], source, dir)).toBeNull()
  })

  it('una fuente inválida produce un config vacío, no una excepción', () => {
    const dir = mkdtempSync(join(tmpdir(), 'gravity-mcp-'))
    const path = writeScopedMcpConfig(['jira'], null, dir)
    const written = JSON.parse(readFileSync(path!, 'utf8')) as { mcpServers: Record<string, unknown> }
    expect(written.mcpServers).toEqual({})
  })

  it('escribe fuera del proyecto: la ruta está bajo el tmpDir dado', () => {
    const dir = mkdtempSync(join(tmpdir(), 'gravity-mcp-'))
    expect(writeScopedMcpConfig(['jira'], source, dir)!.startsWith(dir)).toBe(true)
  })
})
