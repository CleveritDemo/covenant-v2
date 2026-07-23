import { describe, expect, it } from 'vitest'
import {
  AGENT_OBJECTIVE_MAX_LENGTH,
  AGENT_ROLE_MAX_LENGTH,
} from '@shared/agentIdentity'
import {
  allocateAgentSlug,
  agentBindingFromMeta,
  agentDefinitionFromMeta,
  cloneProjectAgentDefinition,
  legacyAgentMetaToDefinition,
  normalizeAgentSlug,
  parseAgentPaneBinding,
  parseProjectAgentDefinition,
  planAgentCatalogMigration,
  resolveAgentPaneMeta,
} from '@shared/projectAgentCatalog'

describe('projectAgentCatalog', () => {
  it('normalizes slugs and allocates unique ids', () => {
    expect(normalizeAgentSlug('  Scout Bot!  ')).toBe('scout-bot')
    expect(allocateAgentSlug('scout', new Set(['scout']))).toBe('scout-2')
  })

  it('parses definitions and clamps identity fields without stripping draft spaces', () => {
    const roleDraft = ` ${'R'.repeat(100)} `
    const objectiveDraft = ` ${'O'.repeat(600)} `
    const parsed = parseProjectAgentDefinition({
      id: 'Architect',
      provider: 'cursor',
      permissionMode: 'readonly',
      name: '  Arch  ',
      role: roleDraft,
      objective: objectiveDraft,
      contextIds: ['a', '', 3, 'b'],
      autoImproveContexts: true,
      emitResults: true,
    })
    expect(parsed).toEqual({
      id: 'architect',
      provider: 'cursor',
      permissionMode: 'plan',
      name: '  Arch  ',
      role: roleDraft.slice(0, AGENT_ROLE_MAX_LENGTH),
      objective: objectiveDraft.slice(0, AGENT_OBJECTIVE_MAX_LENGTH),
      contextIds: ['a', 'b'],
      autoImproveContexts: true,
      emitResults: true,
    })
  })

  it('keeps mid-word spaces so the config modal can type phrases', () => {
    const parsed = parseProjectAgentDefinition({
      id: 'scout',
      provider: 'claude',
      permissionMode: 'ask',
      name: 'Hello ',
      role: 'Full stack ',
      objective: 'Ship features ',
      rules: ['Always reply in Spanish '],
    })
    expect(parsed).toMatchObject({
      name: 'Hello ',
      role: 'Full stack ',
      objective: 'Ship features ',
      rules: ['Always reply in Spanish '],
    })
  })

  it('keeps empty rule drafts so the editor can add slots', () => {
    const parsed = parseProjectAgentDefinition({
      id: 'draft',
      provider: 'claude',
      permissionMode: 'ask',
      rules: [''],
    })
    expect(parsed?.rules).toEqual([''])
  })

  it('converts legacy session meta into catalog + binding', () => {
    const definition = legacyAgentMetaToDefinition(
      'pane-aaaa',
      {
        provider: 'claude',
        permissionMode: 'auto',
        name: 'QA',
        contextIds: ['ctx'],
        cliSessionId: 'sess',
      },
      new Set(),
    )
    expect(definition).toMatchObject({
      id: 'qa',
      provider: 'claude',
      permissionMode: 'auto',
      name: 'QA',
      contextIds: ['ctx'],
    })
    expect(parseAgentPaneBinding({ agentId: 'qa', cliSessionId: ' sess ' })).toEqual({
      agentId: 'qa',
      cliSessionId: 'sess',
    })
  })

  it('resolves runtime meta and round-trips definition/binding', () => {
    const definition = parseProjectAgentDefinition({
      id: 'qa',
      provider: 'cursor',
      permissionMode: 'ask',
      name: 'qa',
      emitResults: true,
    })!
    const meta = resolveAgentPaneMeta(
      { agentId: 'qa', cliSessionId: 'cli-1' },
      definition,
    )
    expect(meta).toMatchObject({
      id: 'qa',
      name: 'qa',
      provider: 'cursor',
      emitResults: true,
      cliSessionId: 'cli-1',
    })
    expect(agentDefinitionFromMeta(meta)).toEqual(definition)
    expect(agentBindingFromMeta(meta)).toEqual({
      agentId: 'qa',
      cliSessionId: 'cli-1',
    })
    expect(cloneProjectAgentDefinition(definition, ' (copy)').name).toBe('qa (copy)')
  })

  it('plans session migration writes and slim bindings', () => {
    const planned = planAgentCatalogMigration(
      [{
        projectFolder: '/tmp/proj',
        paneIds: ['p1'],
        paneKinds: { p1: 'agent' },
        agentByPane: {
          p1: {
            provider: 'cursor',
            permissionMode: 'auto',
            name: 'QA',
            cliSessionId: 's1',
            contextIds: ['c1'],
          },
        },
      }],
    )
    expect(planned.changed).toBe(true)
    expect(planned.writes).toHaveLength(1)
    expect(planned.writes[0]?.definition).toMatchObject({
      id: 'qa',
      provider: 'cursor',
      contextIds: ['c1'],
    })
    expect(planned.tabs[0]?.agentByPane?.p1).toEqual({
      agentId: 'qa',
      cliSessionId: 's1',
    })
  })
})
