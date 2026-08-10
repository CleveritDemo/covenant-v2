import { describe, expect, it } from 'vitest'
import { shouldReplaceOrgAgentCatalog, tabAgentCatalogKey } from '../covenantTypes'
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
    expect(shouldReplaceOrgAgentCatalog([], undefined)).toBe(true)
  })
})

describe('tabAgentCatalogKey local-first', () => {
  it('usa projectFolder también en tabs org (no covenant://)', () => {
    expect(tabAgentCatalogKey({
      projectFolder: '/ws/acme',
      orgWorkspace: { slug: 'acme', workspaceId: 'ws-1' },
    })).toBe('/ws/acme')
  })

  it('sin carpeta → clave vacía (no auto-fetch remoto)', () => {
    expect(tabAgentCatalogKey({
      orgWorkspace: { slug: 'acme', workspaceId: 'ws-1' },
    })).toBe('')
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

  it('respeta definition.order en vez de localeCompare', () => {
    const ordered = projectAgentsFromWorkspaceAgents([
      {
        agentId: 'alpha',
        definition: {
          id: 'alpha',
          provider: 'claude',
          permissionMode: 'auto',
          order: 2,
        },
      },
      {
        agentId: 'zeta',
        definition: {
          id: 'zeta',
          provider: 'claude',
          permissionMode: 'auto',
          order: 0,
          contextIds: ['about'],
        },
      },
      {
        agentId: 'beta',
        definition: {
          id: 'beta',
          provider: 'claude',
          permissionMode: 'auto',
          order: 1,
        },
      },
    ])
    expect(ordered.map(a => a.id)).toEqual(['zeta', 'beta', 'alpha'])
    expect(ordered[0]?.contextIds).toEqual(['about'])
  })

  it('sin order: preferredIds locales y luego ids nuevos estables', () => {
    const ordered = projectAgentsFromWorkspaceAgents(
      [
        {
          agentId: 'new-z',
          definition: { id: 'new-z', provider: 'claude', permissionMode: 'auto' },
        },
        {
          agentId: 'qa',
          definition: { id: 'qa', provider: 'claude', permissionMode: 'auto' },
        },
        {
          agentId: 'frontend',
          definition: { id: 'frontend', provider: 'claude', permissionMode: 'auto' },
        },
      ],
      ['frontend', 'qa'],
    )
    expect(ordered.map(a => a.id)).toEqual(['frontend', 'qa', 'new-z'])
  })
})
