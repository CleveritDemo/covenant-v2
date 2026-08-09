import { describe, expect, it } from 'vitest'
import { shouldReplaceOrgAgentCatalog } from '../covenantTypes'
import { projectAgentsFromWorkspaceAgents } from '../orgWorkspaceContent'

describe('shouldReplaceOrgAgentCatalog', () => {
  it('incoming no vacío, existing undefined => true', () => {
    expect(shouldReplaceOrgAgentCatalog([{ id: 1 }], undefined)).toBe(true)
  })

  it('incoming no vacío, existing no vacío => true', () => {
    expect(shouldReplaceOrgAgentCatalog([{ id: 1 }], [{ id: 2 }])).toBe(true)
  })

  it('incoming vacío, existing no vacío => false (NO pisa)', () => {
    expect(shouldReplaceOrgAgentCatalog([], [{ id: 1 }])).toBe(false)
  })

  it('incoming vacío, existing vacío [] => true', () => {
    expect(shouldReplaceOrgAgentCatalog([], [])).toBe(true)
  })

  it('incoming vacío, existing undefined => true', () => {
    expect(shouldReplaceOrgAgentCatalog([], undefined)).toBe(true)
  })
})

describe('TAREA 0: org agentId round-trip (binding vs list)', () => {
  it('agentId de list gana sobre definition.id (mismo id que persiste el binding)', () => {
    const upsertedSlug = 'fullstack'
    // Backend echo: columna agent_id = slug upsert; JSONB puede traer otro id.
    const listEcho = projectAgentsFromWorkspaceAgents([{
      agentId: upsertedSlug,
      definition: {
        id: 'WRONG-ID-IN-JSONB',
        name: 'Fullstack',
        provider: 'claude',
        permissionMode: 'auto',
      },
    }])
    expect(listEcho[0]?.id).toBe(upsertedSlug)
    expect(listEcho[0]?.name).toBe('Fullstack')
    // session.json binding.agentId = agent.id del upsert echo (= agentId columna)
    expect(listEcho[0]?.id).toBe(upsertedSlug)
  })
})
