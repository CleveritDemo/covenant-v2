import { describe, expect, it } from 'vitest'
import {
  DEFAULT_PROJECT_AGENT_PACK,
  buildBootstrapProjectAgentDefinitions,
} from '../projectAgentBootstrap'

describe('DEFAULT_PROJECT_AGENT_PACK', () => {
  it('has four specs in TL → FE → BE → QA order', () => {
    expect(DEFAULT_PROJECT_AGENT_PACK).toHaveLength(4)
    expect(DEFAULT_PROJECT_AGENT_PACK.map(spec => spec.idHint)).toEqual([
      'tl',
      'frontend',
      'backend',
      'qa',
    ])
  })
})

describe('buildBootstrapProjectAgentDefinitions', () => {
  it('builds four defs with unique ids and TL as orchestrator', () => {
    const defs = buildBootstrapProjectAgentDefinitions('cursor')
    expect(defs).toHaveLength(4)
    const ids = defs.map(item => item.id)
    expect(new Set(ids).size).toBe(4)
    expect(ids[0]).toBe('tl')
    expect(defs[0]?.coordination).toBe('orchestrator')
    expect(defs[0]?.delegateTo?.agentIds).toEqual(['frontend', 'backend', 'qa'])
    expect(defs.slice(1).every(item => item.coordination === undefined)).toBe(true)
    expect(defs.every(item => item.provider === 'cursor')).toBe(true)
    expect(defs.every(item => item.emitResults === true)).toBe(true)
  })

  it('avoids colliding with existing ids', () => {
    const defs = buildBootstrapProjectAgentDefinitions('claude', new Set(['tl', 'qa']))
    expect(defs.map(item => item.id)).toEqual(['tl-2', 'frontend', 'backend', 'qa-2'])
    expect(defs[0]?.coordination).toBe('orchestrator')
    expect(defs[0]?.delegateTo?.agentIds).toEqual(['frontend', 'backend', 'qa-2'])
  })
})
