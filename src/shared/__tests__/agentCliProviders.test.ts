import { describe, expect, it } from 'vitest'
import { AGENT_CLI_PROVIDERS } from '../agentCliProviders'

const claudeArgs = (over: Partial<Parameters<typeof AGENT_CLI_PROVIDERS.claude.args>[0]> = {}) =>
  AGENT_CLI_PROVIDERS.claude.args({ prompt: 'hola', cwd: '/repo', mode: 'auto', ...over })

/** Valor que sigue a la primera aparición de `flag`, o undefined. */
const valueOf = (args: string[], flag: string): string | undefined => {
  const at = args.indexOf(flag)
  return at === -1 ? undefined : args[at + 1]
}
const countOf = (args: string[], flag: string): number =>
  args.filter(arg => arg === flag).length

describe('claude · gate de skills', () => {
  it('sin disableSkills no emite --disallowedTools en modo auto', () => {
    expect(countOf(claudeArgs(), '--disallowedTools')).toBe(0)
  })

  it('disableSkills en modo auto deniega solo Skill', () => {
    const args = claudeArgs({ disableSkills: true })
    expect(countOf(args, '--disallowedTools')).toBe(1)
    expect(valueOf(args, '--disallowedTools')).toBe('Skill')
  })

  it('modo ask + disableSkills fusionan en UN solo flag', () => {
    const args = claudeArgs({ mode: 'ask', disableSkills: true })
    expect(countOf(args, '--disallowedTools')).toBe(1)
    expect(valueOf(args, '--disallowedTools'))
      .toBe('Edit,Write,NotebookEdit,Bash,MultiEdit,Skill')
  })

  it('modo ask sin disableSkills conserva la lista original', () => {
    expect(valueOf(claudeArgs({ mode: 'ask' }), '--disallowedTools'))
      .toBe('Edit,Write,NotebookEdit,Bash,MultiEdit')
  })
})

describe('claude · allowlist de namespace', () => {
  it('siempre excluye el scope de usuario', () => {
    // Sin esto, --plugin-dir solo suma: los plugins de ~/.claude/plugins
    // seguirían siendo descubribles y la allowlist no acotaría nada.
    expect(valueOf(claudeArgs(), '--setting-sources')).toBe('project')
  })

  it('emite un --plugin-dir por ruta, en orden', () => {
    const args = claudeArgs({ pluginDirs: ['/p/superpowers', '/p/ponytail'] })
    expect(countOf(args, '--plugin-dir')).toBe(2)
    const at = args.indexOf('--plugin-dir')
    expect(args.slice(at, at + 4))
      .toEqual(['--plugin-dir', '/p/superpowers', '--plugin-dir', '/p/ponytail'])
  })

  it('sin rutas no emite ningún --plugin-dir', () => {
    expect(countOf(claudeArgs({ pluginDirs: [] }), '--plugin-dir')).toBe(0)
    expect(countOf(claudeArgs(), '--plugin-dir')).toBe(0)
  })
})

describe('claude · allowlist de MCP', () => {
  it('con ruta emite --mcp-config y --strict-mcp-config', () => {
    const args = claudeArgs({ mcpConfigPath: '/tmp/x/mcp.json' })
    expect(valueOf(args, '--mcp-config')).toBe('/tmp/x/mcp.json')
    expect(args).toContain('--strict-mcp-config')
  })

  it('sin ruta no emite ninguno de los dos', () => {
    const args = claudeArgs()
    expect(countOf(args, '--mcp-config')).toBe(0)
    expect(args).not.toContain('--strict-mcp-config')
  })
})
