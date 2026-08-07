import { describe, it, expect, beforeEach } from 'vitest'
import { parseCliVersion, resolveAgentCli, clearAgentCliVersionCache } from '../agentCliResolve'

// `node` siempre existe en el entorno de test y responde a --version.
const NODE = process.execPath

describe('parseCliVersion', () => {
  it('extrae la versión de las salidas típicas de --version', () => {
    expect(parseCliVersion('2.1.4 (Claude Code)')).toBe('2.1.4')
    expect(parseCliVersion('cursor-agent 0.8.2\n')).toBe('0.8.2')
    expect(parseCliVersion('v22.11.0')).toBe('22.11.0')
    expect(parseCliVersion('copilot 1.0.0-beta.3')).toBe('1.0.0-beta.3')
    expect(parseCliVersion('0.4')).toBe('0.4')
  })

  it('devuelve null cuando no hay nada que parezca una versión', () => {
    expect(parseCliVersion('')).toBeNull()
    expect(parseCliVersion('command not found')).toBeNull()
  })
})

describe('resolveAgentCli', () => {
  beforeEach(() => { clearAgentCliVersionCache() })

  it('resuelve ruta y versión de un binario existente', async () => {
    const result = await resolveAgentCli('claude', NODE, { agentCliCommands: {} })
    expect(result.provider).toBe('claude')
    expect(result.command).toBe(NODE)
    expect(result.path).toBeTruthy()
    expect(result.version).toMatch(/^\d+\.\d+/)
  })

  it('devuelve path null sin lanzar cuando el comando no está en el PATH', async () => {
    const result = await resolveAgentCli('copilot', 'no-existe-este-cli-xyz', { agentCliCommands: {} })
    expect(result.path).toBeNull()
    expect(result.version).toBeNull()
    expect(result.command).toBe('no-existe-este-cli-xyz')
  })

  // El fallback al comando por defecto del proveedor es `agentCliCommand`, ya cubierto
  // en agentCliCommandsConfig.test.ts. Comprobarlo aquí resolvería binarios reales de
  // la máquina y haría el test dependiente de qué CLIs estén instalados.
  it('cae al comando configurado cuando no se pasa ninguno', async () => {
    const configured = await resolveAgentCli('gemini', '   ', { agentCliCommands: { gemini: NODE } })
    expect(configured.command).toBe(NODE)
    expect(configured.path).toBeTruthy()
  })
})
