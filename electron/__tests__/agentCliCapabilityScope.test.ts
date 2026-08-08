import { describe, expect, it } from 'vitest'
import { mkdirSync, mkdtempSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import type { AppConfig } from '../../src/shared/configSchema'
import type { AgentCliStartRequest } from '../../src/shared/agentCliTypes'
import {
  AGENT_CLI_PROVIDER_IDS,
  providerCapabilities,
} from '../../src/shared/agentCliProviders'
import { commandAndArgs } from '../agentCliRuntime'

const config = { agentCliCommands: {} } as AppConfig
const INSTALL_PATH = '/home/u/.claude/plugins/cache/official/superpowers/6.2.0'

/** Home con un plugin instalado, para que la allowlist resuelva a un directorio. */
function homeWithPlugin(): string {
  const home = mkdtempSync(join(tmpdir(), 'gravity-caps-home-'))
  mkdirSync(join(home, '.claude', 'plugins'), { recursive: true })
  writeFileSync(
    join(home, '.claude', 'plugins', 'installed_plugins.json'),
    JSON.stringify({
      version: 2,
      plugins: {
        'superpowers@official': [{ scope: 'user', installPath: INSTALL_PATH, version: '6.2.0' }],
      },
    }),
  )
  return home
}

/** Home con la config MCP propia de Copilot, que es su única fuente. */
function homeWithCopilotMcps(names: string[]): string {
  const home = mkdtempSync(join(tmpdir(), 'gravity-caps-copilot-'))
  mkdirSync(join(home, '.copilot'), { recursive: true })
  writeFileSync(
    join(home, '.copilot', 'mcp-config.json'),
    JSON.stringify({
      mcpServers: Object.fromEntries(names.map(name => [name, { command: 'node' }])),
    }),
  )
  return home
}

function argsFor(
  partial: Partial<AgentCliStartRequest> & Pick<AgentCliStartRequest, 'provider' | 'permissionMode'>,
  home = '/home/test',
): string[] {
  const request: AgentCliStartRequest = { paneId: 'pane', prompt: 'hola', cwd: '/tmp', ...partial }
  return commandAndArgs(request, config, '/tmp', 'p', undefined, home).args
}

/** Valor que sigue a la primera aparición del flag. */
const valueAfter = (args: string[], flag: string): string | undefined =>
  args[args.indexOf(flag) + 1]

/** Todos los valores de un flag repetible. */
const valuesOf = (args: string[], flag: string): string[] =>
  args.flatMap((arg, index) => (arg === flag ? [args[index + 1]] : []))

describe('acotado de MCP por proveedor', () => {
  it('claude: config efímero + --strict-mcp-config', () => {
    const args = argsFor({ provider: 'claude', permissionMode: 'auto', mcpsAllowed: ['jira'] })
    expect(args).toContain('--strict-mcp-config')
    expect(valueAfter(args, '--mcp-config')).toMatch(/mcp\.json$/)
  })

  it('gemini: allowlist nativa por nombre', () => {
    const args = argsFor({ provider: 'gemini', permissionMode: 'auto', mcpsAllowed: ['jira', 'ctx7'] })
    expect(args.slice(args.indexOf('--allowed-mcp-server-names'))).toEqual(
      expect.arrayContaining(['jira', 'ctx7']),
    )
  })

  it('copilot: apaga los configurados que no están permitidos, y solo esos', () => {
    const home = homeWithCopilotMcps(['jira', 'sentry', 'linear'])
    const args = argsFor({ provider: 'copilot', permissionMode: 'auto', mcpsAllowed: ['jira'] }, home)
    expect(args).toContain('--disable-builtin-mcps')
    expect(valuesOf(args, '--disable-mcp-server').sort()).toEqual(['linear', 'sentry'])
  })

  it('copilot: si la allowlist cubre todo lo configurado no apaga nada', () => {
    const home = homeWithCopilotMcps(['jira'])
    const args = argsFor({ provider: 'copilot', permissionMode: 'auto', mcpsAllowed: ['jira'] }, home)
    expect(args).not.toContain('--disable-builtin-mcps')
    expect(args).not.toContain('--disable-mcp-server')
  })

  it('sin allowlist ningún proveedor emite flags de acotado de MCP', () => {
    for (const provider of AGENT_CLI_PROVIDER_IDS) {
      const args = argsFor({ provider, permissionMode: 'auto' })
      for (const flag of ['--mcp-config', '--allowed-mcp-server-names', '--disable-mcp-server']) {
        expect(args, `${provider} ${flag}`).not.toContain(flag)
      }
    }
  })

  it('un proveedor sin la capacidad ignora la allowlist en vez de inventar flags', () => {
    const before = argsFor({ provider: 'cursor', permissionMode: 'auto' })
    const after = argsFor({ provider: 'cursor', permissionMode: 'auto', mcpsAllowed: ['jira'] })
    expect(after).toEqual(before)
  })
})

describe('acotado de skills por proveedor', () => {
  it('pi: --no-skills siempre; los permitidos vuelven por --skill', () => {
    const off = argsFor({ provider: 'pi', permissionMode: 'auto' })
    expect(off).toContain('--no-skills')
    expect(off).not.toContain('--skill')

    const on = argsFor(
      { provider: 'pi', permissionMode: 'auto', nativeSkills: { enabled: true, namespaces: ['superpowers'] } },
      homeWithPlugin(),
    )
    expect(on).toContain('--no-skills')
    expect(valuesOf(on, '--skill')).toEqual([INSTALL_PATH])
  })

  it('kimi: --skills-dir apunta a los permitidos, o a un directorio vacío', () => {
    const off = argsFor({ provider: 'kimi', permissionMode: 'auto' })
    expect(valuesOf(off, '--skills-dir')).toEqual([join(tmpdir(), 'gravity-skills-empty')])

    const on = argsFor(
      { provider: 'kimi', permissionMode: 'auto', nativeSkills: { enabled: true, namespaces: ['superpowers'] } },
      homeWithPlugin(),
    )
    expect(valuesOf(on, '--skills-dir')).toEqual([INSTALL_PATH])
  })

  it('opencode: --pure solo con el gate apagado', () => {
    expect(argsFor({ provider: 'opencode', permissionMode: 'auto' })).toContain('--pure')
    expect(argsFor({ provider: 'opencode', permissionMode: 'auto', nativeSkills: { enabled: true } }))
      .not.toContain('--pure')
  })

  it('los proveedores que solo saben apagar no declaran allowlist', () => {
    expect(providerCapabilities('opencode')).toEqual({
      nativeSkills: true, nativeSkillNamespaces: false, mcpAllowlist: false,
    })
    expect(providerCapabilities('claude')).toEqual({
      nativeSkills: true, nativeSkillNamespaces: true, mcpAllowlist: true,
    })
    expect(providerCapabilities('copilot')).toEqual({
      nativeSkills: false, nativeSkillNamespaces: false, mcpAllowlist: true,
    })
    // Un CLI que solo sabe sumar no promete nada.
    expect(providerCapabilities('cursor')).toEqual({
      nativeSkills: false, nativeSkillNamespaces: false, mcpAllowlist: false,
    })
  })
})
