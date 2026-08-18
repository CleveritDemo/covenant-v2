import { describe, expect, it } from 'vitest'
import {
  DEFAULT_PROJECT_AGENT_PACK,
  buildBootstrapProjectAgentDefinitions,
} from '../projectAgentBootstrap'

describe('DEFAULT_PROJECT_AGENT_PACK', () => {
  it('has seven Covenant roles in plane order', () => {
    expect(DEFAULT_PROJECT_AGENT_PACK).toHaveLength(7)
    expect(DEFAULT_PROJECT_AGENT_PACK.map(spec => spec.idHint)).toEqual([
      'tl',
      'tech-lead-copy',
      'frontend',
      'backend',
      'qa',
      'product-designer',
      'product-owner',
    ])
    expect(DEFAULT_PROJECT_AGENT_PACK.every(spec => !/\b(David|Cristian|Vanesa|Maria)\b/i.test(spec.name))).toBe(true)
  })
})

describe('buildBootstrapProjectAgentDefinitions', () => {
  it('builds seven defs with role names and orchestrator wiring', () => {
    const defs = buildBootstrapProjectAgentDefinitions('cursor')
    expect(defs).toHaveLength(7)
    const ids = defs.map(item => item.id)
    expect(new Set(ids).size).toBe(7)
    expect(ids).toEqual([
      'tl',
      'tech-lead-copy',
      'frontend',
      'backend',
      'qa',
      'product-designer',
      'product-owner',
    ])

    const tl = defs[0]
    const tlTurbo = defs[1]
    expect(tl?.name).toBe('Tech Lead')
    expect(tl?.coordination).toBe('orchestrator')
    expect(tl?.provider).toBe('claude')
    expect(tl?.model).toBe('claude-fable-5')
    expect(tl?.delegateTo?.agentIds).toEqual(['frontend', 'backend', 'qa'])

    expect(tlTurbo?.name).toBe('TL Turbo')
    expect(tlTurbo?.coordination).toBe('orchestrator')
    expect(tlTurbo?.orchestrationWorkStyle).toBe('turbo')
    expect(tlTurbo?.delegateTo?.agentIds).toEqual(['frontend', 'backend', 'qa'])

    expect(defs[2]?.name).toBe('Frontend')
    expect(defs[2]?.provider).toBe('cursor')
    expect(defs[3]?.name).toBe('Backend')
    expect(defs[3]?.model).toBe('composer-2.5')
    expect(defs[4]?.name).toBe('QA')
    expect(defs[4]?.provider).toBe('copilot')
    expect(defs[4]?.role).toBe('qa expert')

    expect(defs[5]?.name).toBe('Product Designer')
    expect(defs[5]?.acceptDelegations).toBe(false)

    expect(defs[6]?.name).toBe('Product Owner')
    expect(defs[6]?.coordination).toBe('productOwner')
    expect(defs[6]?.ceremonyRoles).toEqual(['productOwner'])

    expect(defs.every(item => item.emitResults === true)).toBe(true)
  })

  it('avoids colliding with existing ids', () => {
    const defs = buildBootstrapProjectAgentDefinitions('claude', new Set(['tl', 'qa']))
    expect(defs.map(item => item.id)).toEqual([
      'tl-2',
      'tech-lead-copy',
      'frontend',
      'backend',
      'qa-2',
      'product-designer',
      'product-owner',
    ])
    expect(defs[0]?.coordination).toBe('orchestrator')
    expect(defs[0]?.delegateTo?.agentIds).toEqual(['frontend', 'backend', 'qa-2'])
    expect(defs[1]?.delegateTo?.agentIds).toEqual(['frontend', 'backend', 'qa-2'])
  })
})
