import { describe, expect, it } from 'vitest'
import {
  AGENT_CLI_PROVIDER_IDS,
  AGENT_CLI_PROVIDERS,
  agentCliInstallCommand,
  agentCliSpec,
  providerCapabilities,
} from '../agentCliProviders'

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

  it('modo plan no emite --disallowedTools por escritura', () => {
    expect(countOf(claudeArgs({ mode: 'plan' }), '--disallowedTools')).toBe(0)
  })

  it('modo plan + disableSkills deniega solo Skill', () => {
    const args = claudeArgs({ mode: 'plan', disableSkills: true })
    expect(countOf(args, '--disallowedTools')).toBe(1)
    expect(valueOf(args, '--disallowedTools')).toBe('Skill')
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

const cursorArgs = (over: Partial<Parameters<typeof AGENT_CLI_PROVIDERS.cursor.args>[0]> = {}) =>
  AGENT_CLI_PROVIDERS.cursor.args({ prompt: 'hola', cwd: '/repo', mode: 'auto', ...over })

describe('cursor', () => {
  it('args mode auto incluyen --trust', () => {
    expect(cursorArgs({ mode: 'auto' })).toContain('--trust')
  })

  it('args mode plan incluyen --trust', () => {
    expect(cursorArgs({ mode: 'plan' })).toContain('--trust')
  })

  it('--trust presente aunque no haya --force (plan)', () => {
    const args = cursorArgs({ mode: 'plan' })
    expect(args).toContain('--trust')
    expect(args).not.toContain('--force')
  })
})

describe('capacidades por proveedor', () => {
  it('claude soporta las dos', () => {
    expect(providerCapabilities('claude')).toEqual({
      nativeSkills: true, nativeSkillNamespaces: true, mcpAllowlist: true,
    })
  })

  it('los proveedores sin flags verificados no soportan ninguna', () => {
    // Fallar visible, no en silencio: la UI deshabilita lo que no puede
    // acotar en vez de prometerlo.
    expect(providerCapabilities('cursor')).toEqual({
      nativeSkills: false, nativeSkillNamespaces: false, mcpAllowlist: false,
    })
  })
})

describe('agentCliInstallCommand', () => {
  it('devuelve npm install -g para claude', () => {
    expect(agentCliInstallCommand('claude')).toBe('npm install -g @anthropic-ai/claude-code')
  })

  it('devuelve npm install -g para opencode', () => {
    expect(agentCliInstallCommand('opencode')).toBe('npm install -g opencode-ai')
  })

  it('es vacío para cursor, kimi y hermes', () => {
    expect(agentCliInstallCommand('cursor')).toBe('')
    expect(agentCliInstallCommand('kimi')).toBe('')
    expect(agentCliInstallCommand('hermes')).toBe('')
  })
})

describe('install metadata', () => {
  it('docsUrl y npmPackage presentes no están vacíos', () => {
    for (const id of AGENT_CLI_PROVIDER_IDS) {
      const install = agentCliSpec(id).install
      if (install?.docsUrl !== undefined) expect(install.docsUrl).not.toBe('')
      if (install?.npmPackage !== undefined) expect(install.npmPackage).not.toBe('')
    }
  })
})
