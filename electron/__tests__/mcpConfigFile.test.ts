import { describe, expect, it } from 'vitest'
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import {
  ensureMcpConfigFile,
  mcpConfigPathFor,
  readMcpConfigText,
  writeMcpConfigText,
  writeScopedMcpConfig,
} from '../mcpConfigFile'
import { MCP_CONFIG_MAX_BYTES } from '../../src/shared/mcpConfigText'

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

describe('mcpConfigPathFor', () => {
  it('cada CLI apunta a su propio archivo', () => {
    expect(mcpConfigPathFor('copilot', '/proj', '/home/me'))
      .toBe(join('/home/me', '.copilot', 'mcp-config.json'))
    expect(mcpConfigPathFor('gemini', '/proj', '/home/me'))
      .toBe(join('/home/me', '.gemini', 'settings.json'))
    // El resto lee el del proyecto, no el del usuario.
    expect(mcpConfigPathFor('claude', '/proj', '/home/me')).toBe(join('/proj', '.mcp.json'))
  })
})

describe('ensureMcpConfigFile', () => {
  it('crea el archivo con un mcpServers vacío y sus carpetas', () => {
    const dir = mkdtempSync(join(tmpdir(), 'gravity-mcp-ensure-'))
    const path = join(dir, 'nested', 'mcp-config.json')

    expect(ensureMcpConfigFile(path)).toEqual({ created: true })
    expect(existsSync(path)).toBe(true)
    expect(JSON.parse(readFileSync(path, 'utf8'))).toEqual({ mcpServers: {} })
  })

  it('nunca pisa uno que ya existe', () => {
    const dir = mkdtempSync(join(tmpdir(), 'gravity-mcp-ensure-'))
    const path = join(dir, 'mcp-config.json')
    writeFileSync(path, '{"mcpServers":{"jira":{"command":"jira-mcp"}}}', 'utf8')

    expect(ensureMcpConfigFile(path)).toEqual({ created: false })
    expect(JSON.parse(readFileSync(path, 'utf8')).mcpServers.jira.command).toBe('jira-mcp')
  })
})

describe('readMcpConfigText / writeMcpConfigText', () => {
  it('lee vacío cuando el archivo no existe', () => {
    const dir = mkdtempSync(join(tmpdir(), 'gravity-mcp-text-'))
    expect(readMcpConfigText(join(dir, 'missing.json'))).toEqual({ text: '', exists: false })
  })

  it('escribe atómicamente preservando el texto y exige newline final', () => {
    const dir = mkdtempSync(join(tmpdir(), 'gravity-mcp-text-'))
    const path = join(dir, 'nested', '.mcp.json')
    const body = '{\n  "mcpServers": {\n    "jira": {}\n  }\n}'

    writeMcpConfigText(path, body)
    expect(readMcpConfigText(path)).toEqual({ text: `${body}\n`, exists: true })
    expect(existsSync(`${path}.tmp`)).toBe(false)
  })

  it('rechaza JSON inválido antes de tocar el disco', () => {
    const dir = mkdtempSync(join(tmpdir(), 'gravity-mcp-text-'))
    const path = join(dir, '.mcp.json')
    writeFileSync(path, '{"mcpServers":{"ok":{}}}\n', 'utf8')

    expect(() => writeMcpConfigText(path, '{"mcpServers":')).toThrow('invalid-json')
    expect(readFileSync(path, 'utf8')).toBe('{"mcpServers":{"ok":{}}}\n')
  })

  it('rechaza payloads demasiado grandes', () => {
    const dir = mkdtempSync(join(tmpdir(), 'gravity-mcp-text-'))
    const path = join(dir, '.mcp.json')
    const huge = `{"mcpServers":{"x":{"n":"${'a'.repeat(MCP_CONFIG_MAX_BYTES)}"}}}`
    expect(() => writeMcpConfigText(path, huge)).toThrow('too-large')
    expect(existsSync(path)).toBe(false)
  })

  it('no pisa el archivo si cambió fuera desde que se leyó', () => {
    const dir = mkdtempSync(join(tmpdir(), 'gravity-mcp-text-'))
    const path = join(dir, '.mcp.json')
    const abierto = '{"mcpServers":{"jira":{}}}\n'
    writeFileSync(path, abierto, 'utf8')
    // Alguien escribe por fuera: ahí puede estar el token que no vuelve.
    const deOtro = '{"mcpServers":{"jira":{"token":"x"}}}\n'
    writeFileSync(path, deOtro, 'utf8')

    expect(() => writeMcpConfigText(path, '{"mcpServers":{}}', abierto))
      .toThrow('changed-outside')
    expect(readFileSync(path, 'utf8')).toBe(deOtro)
  })

  it('escribe cuando el disco coincide, y también sin expected (sobrescribir)', () => {
    const dir = mkdtempSync(join(tmpdir(), 'gravity-mcp-text-'))
    const path = join(dir, '.mcp.json')
    const disco = '{"mcpServers":{"jira":{}}}\n'
    writeFileSync(path, disco, 'utf8')

    writeMcpConfigText(path, '{"mcpServers":{"a":{}}}', disco)
    expect(readFileSync(path, 'utf8')).toBe('{"mcpServers":{"a":{}}}\n')

    writeMcpConfigText(path, '{"mcpServers":{"b":{}}}')
    expect(readFileSync(path, 'utf8')).toBe('{"mcpServers":{"b":{}}}\n')
  })

  it('con expected vacío escribe si el archivo sigue sin existir', () => {
    const dir = mkdtempSync(join(tmpdir(), 'gravity-mcp-text-'))
    const path = join(dir, '.mcp.json')
    writeMcpConfigText(path, '{"mcpServers":{}}', '')
    expect(existsSync(path)).toBe(true)
  })
})
