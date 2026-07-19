import { describe, expect, it } from 'vitest'
import { buildModeHandoffPrompt } from '../agentModeHandoff'
import type { AgentChatEntry } from '../agentCliTypes'

function entry(
  role: AgentChatEntry['role'],
  content: string,
): AgentChatEntry {
  return { id: `${role}-${content.slice(0, 8)}`, role, content }
}

describe('buildModeHandoffPrompt', () => {
  it('injects prior user/assistant turns before the new request', () => {
    const prompt = buildModeHandoffPrompt(
      [
        entry('user', 'Diseña un plan para renombrar X'),
        entry('assistant', 'Plan:\n1. Renombrar archivo\n2. Actualizar imports'),
      ],
      'Ejecuta el plan',
    )
    expect(prompt).toContain('## Prior conversation')
    expect(prompt).toContain('### User\nDiseña un plan para renombrar X')
    expect(prompt).toContain('### Assistant\nPlan:')
    expect(prompt).toContain('## Current user request\nEjecuta el plan')
  })

  it('keeps the most recent messages when truncating', () => {
    const prior = [
      entry('user', 'A'.repeat(400)),
      entry('assistant', 'B'.repeat(400)),
      entry('user', 'latest-user'),
      entry('assistant', 'latest-assistant'),
    ]
    const prompt = buildModeHandoffPrompt(prior, 'go', 500)
    expect(prompt).toContain('latest-user')
    expect(prompt).toContain('latest-assistant')
    expect(prompt).not.toContain('A'.repeat(40))
  })

  it('skips empty messages', () => {
    const prompt = buildModeHandoffPrompt(
      [entry('assistant', '   '), entry('user', 'hola')],
      'sigue',
    )
    expect(prompt).toContain('### User\nhola')
    expect(prompt.match(/### Assistant/g) ?? []).toHaveLength(0)
  })
})
