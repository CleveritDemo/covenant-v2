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
