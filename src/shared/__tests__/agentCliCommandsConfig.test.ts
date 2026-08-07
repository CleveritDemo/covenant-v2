import { describe, expect, it } from 'vitest'
import { mergeWithDefaults, validateConfig, CONFIG_DEFAULTS } from '../configSchema'
import { agentCliCommand } from '../agentCliProviders'

describe('migración de los comandos de CLI', () => {
  it('pliega las tres claves viejas en agentCliCommands y las descarta', () => {
    const merged = mergeWithDefaults({
      agentCliClaudeCommand: '/usr/local/bin/claude',
      agentCliCursorCommand: 'agent',
      agentCliCopilotCommand: 'copilot',
    } as never)
    expect(merged.agentCliCommands).toEqual({
      claude: '/usr/local/bin/claude',
      cursor: 'agent',
      copilot: 'copilot',
    })
    expect(merged).not.toHaveProperty('agentCliClaudeCommand')
  })

  it('lo nuevo gana sobre lo viejo y los vacíos no se guardan', () => {
    const merged = mergeWithDefaults({
      agentCliClaudeCommand: 'viejo',
      agentCliCommands: { claude: 'nuevo', codex: '  ' },
    } as never)
    expect(merged.agentCliCommands).toEqual({ claude: 'nuevo' })
  })

  it('sin configuración se usa el ejecutable por defecto del proveedor', () => {
    expect(agentCliCommand(CONFIG_DEFAULTS.agentCliCommands, 'cursor')).toBe('agent')
    expect(agentCliCommand({ cursor: 'cursor-agent' }, 'cursor')).toBe('cursor-agent')
  })

  it('un proveedor desconocido en la config es un error de validación', () => {
    const config = mergeWithDefaults({})
    expect(validateConfig(config)).toEqual([])
    expect(validateConfig({ ...config, agentCliCommands: { nope: 'x' } as never }))
      .toContain('agentCliCommands["nope"] no es un proveedor conocido')
  })
})
