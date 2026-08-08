import { describe, expect, it } from 'vitest'
import {
  AGENT_OBJECTIVE_MAX_LENGTH,
  AGENT_ROLE_MAX_LENGTH,
} from '@shared/agentIdentity'
import {
  allocateAgentSlug,
  agentBindingFromMeta,
  agentDefinitionFromMeta,
  buildNewProjectAgentDefinition,
  cloneProjectAgentDefinition,
  legacyAgentMetaToDefinition,
  normalizeAgentSlug,
  parseAgentPaneBinding,
  parseProjectAgentDefinition,
  planAgentCatalogMigration,
  remapAgentBindingsInTabs,
  remapAgentResultContextIds,
  remapAgentResultIdsInCatalog,
  remapAgentResultTabContexts,
  resolveAgentPaneMeta,
  resolveCatalogAgentId,
  isAgentOwnResultContext,
  agentResultContextIdForSlug,
} from '@shared/projectAgentCatalog'

describe('projectAgentCatalog', () => {
  it('normalizes slugs and allocates unique ids', () => {
    expect(normalizeAgentSlug('  Scout Bot!  ')).toBe('scout-bot')
    expect(allocateAgentSlug('scout', new Set(['scout']))).toBe('scout-2')
  })

  it('detects an agent own results context id', () => {
    expect(isAgentOwnResultContext('fullstack', 'iaterminal:result:fullstack')).toBe(true)
    expect(isAgentOwnResultContext('  Full Stack  ', agentResultContextIdForSlug('Full Stack'))).toBe(true)
    expect(isAgentOwnResultContext('fullstack', 'iaterminal:result:qa')).toBe(false)
    expect(isAgentOwnResultContext('fullstack', 'iaterminal:notes:x')).toBe(false)
    expect(isAgentOwnResultContext('', 'iaterminal:result:fullstack')).toBe(false)
    expect(isAgentOwnResultContext(null, 'iaterminal:result:fullstack')).toBe(false)
  })

  it('strips own results from parsed contextIds', () => {
    const parsed = parseProjectAgentDefinition({
      id: 'qa',
      provider: 'cursor',
      permissionMode: 'ask',
      contextIds: [
        'iaterminal:folderTree:folders',
        'iaterminal:result:qa',
        'iaterminal:result:fullstack',
      ],
    })
    expect(parsed?.contextIds).toEqual([
      'iaterminal:folderTree:folders',
      'iaterminal:result:fullstack',
    ])
  })

  it('builds new agent definition from name with emitResults on', () => {
    const definition = buildNewProjectAgentDefinition(
      'cursor',
      '  Product Designer  ',
      new Set(['product-designer']),
    )
    expect(definition).toMatchObject({
      id: 'product-designer-2',
      provider: 'cursor',
      permissionMode: 'auto',
      autoImproveContexts: true,
      emitResults: true,
      name: 'Product Designer',
    })
    expect(definition.id).toBe(
      allocateAgentSlug('Product Designer', new Set(['product-designer'])),
    )
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

  it('normaliza el monograma del JSON y lo mantiene al clonar', () => {
    const parsed = parseProjectAgentDefinition({
      id: 'tl',
      provider: 'claude',
      permissionMode: 'auto',
      name: 'Tech Lead',
      monogram: 't.l',
    })
    expect(parsed?.monogram).toBe('TL')
    expect(cloneProjectAgentDefinition(parsed!, ' copy').monogram).toBe('TL')
    expect(parseProjectAgentDefinition({
      id: 'tl',
      provider: 'claude',
      permissionMode: 'auto',
      monogram: '  ',
    })).not.toHaveProperty('monogram')
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
      emitResults: true,
    })
  })

  it('parses coordination and acceptDelegations flags', () => {
    const orch = parseProjectAgentDefinition({
      id: 'boss',
      provider: 'claude',
      permissionMode: 'auto',
      coordination: 'orchestrator',
      acceptDelegations: false,
      orchestrationMaxRounds: 7,
      allowExpertReplicas: true,
    })
    expect(orch).toMatchObject({
      coordination: 'orchestrator',
      acceptDelegations: false,
      orchestrationMaxRounds: 7,
      allowExpertReplicas: true,
    })
    const clone = cloneProjectAgentDefinition(orch!)
    expect(clone.coordination).toBe('orchestrator')
    expect(clone.acceptDelegations).toBe(false)
    expect(clone.orchestrationMaxRounds).toBe(7)
    expect(clone.allowExpertReplicas).toBe(true)

    const unlimited = parseProjectAgentDefinition({
      id: 'boss-unlimited',
      provider: 'claude',
      permissionMode: 'auto',
      coordination: 'orchestrator',
      orchestrationMaxRounds: 0,
    })
    expect(unlimited?.orchestrationMaxRounds).toBe(0)
    expect(cloneProjectAgentDefinition(unlimited!).orchestrationMaxRounds).toBe(0)

    const defaultRounds = parseProjectAgentDefinition({
      id: 'boss-default',
      provider: 'claude',
      permissionMode: 'auto',
      coordination: 'orchestrator',
      orchestrationMaxRounds: 3,
    })
    expect(defaultRounds?.orchestrationMaxRounds).toBeUndefined()
    expect(defaultRounds?.allowExpertReplicas).toBeUndefined()

    const po = parseProjectAgentDefinition({
      id: 'po',
      provider: 'claude',
      permissionMode: 'ask',
      coordination: 'productOwner',
      orchestrationMaxRounds: 5,
      allowExpertReplicas: true,
    })
    expect(po).toMatchObject({
      coordination: 'productOwner',
      orchestrationMaxRounds: 5,
      allowExpertReplicas: true,
    })
    const poClone = cloneProjectAgentDefinition(po!)
    expect(poClone.coordination).toBe('productOwner')
    expect(poClone.orchestrationMaxRounds).toBe(5)
    expect(poClone.allowExpertReplicas).toBe(true)

    const specialist = parseProjectAgentDefinition({
      id: 'qa',
      provider: 'claude',
      permissionMode: 'ask',
      allowExpertReplicas: true,
    })
    expect(specialist?.allowExpertReplicas).toBeUndefined()
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
      nativeSkills: { enabled: true, namespaces: ['superpowers'] },
      mcpsAllowed: ['jira'],
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
      nativeSkills: { enabled: true, namespaces: ['superpowers'] },
      mcpsAllowed: ['jira'],
    })
    expect(agentDefinitionFromMeta(meta)).toEqual(definition)
    expect(agentBindingFromMeta(meta)).toEqual({
      agentId: 'qa',
      cliSessionId: 'cli-1',
    })
    expect(cloneProjectAgentDefinition(definition, ' (copy)').name).toBe('qa (copy)')
    expect(cloneProjectAgentDefinition({
      id: 'legacy',
      provider: 'claude',
      permissionMode: 'ask',
    }, ' (copy)')).toMatchObject({ emitResults: true })
  })

  it('resolves meta.id from unique display-name slug when binding used name', () => {
    const definition = parseProjectAgentDefinition({
      id: 'example2',
      provider: 'cursor',
      permissionMode: 'auto',
      name: 'fullstack',
    })!
    const meta = resolveAgentPaneMeta(
      { agentId: 'fullstack' },
      undefined,
      [definition],
    )
    expect(meta.id).toBe('example2')
    expect(meta.name).toBe('fullstack')
    expect(resolveCatalogAgentId([definition], 'fullstack')).toBe('example2')
    expect(resolveCatalogAgentId([definition], 'example2')).toBe('example2')
  })

  it('strips legacy rich meta without catalog writes', () => {
    const planned = planAgentCatalogMigration(
      [{
        projectFolder: '/tmp/proj',
        paneIds: ['term', 'p1'],
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
    expect(planned.writes).toEqual([])
    expect(planned.tabs[0]?.paneIds).toEqual(['term'])
    expect(planned.tabs[0]?.agentByPane).toBeUndefined()
    expect(planned.tabs[0]?.paneKinds).toBeUndefined()
  })

  it('keeps slim bindings without writes', () => {
    const planned = planAgentCatalogMigration(
      [{
        projectFolder: '/tmp/proj',
        paneIds: ['p1'],
        paneKinds: { p1: 'agent' },
        agentByPane: {
          p1: { agentId: 'qa', cliSessionId: 's1' },
        },
      }],
    )
    expect(planned.changed).toBe(false)
    expect(planned.writes).toEqual([])
    expect(planned.tabs[0]?.agentByPane?.p1).toEqual({
      agentId: 'qa',
      cliSessionId: 's1',
    })
  })

  it('remaps pane bindings and result context ids when slug changes', () => {
    const tabs = remapAgentBindingsInTabs(
      [
        {
          projectFolder: '/repo',
          agentByPane: {
            a: { agentId: 'claude', cliSessionId: 's' },
            b: { agentId: 'other' },
          },
        },
        {
          projectFolder: '/other',
          agentByPane: { a: { agentId: 'claude' } },
        },
      ],
      '/repo',
      'claude',
      'fullstack',
    )
    expect(tabs[0]?.agentByPane).toEqual({
      a: { agentId: 'fullstack', cliSessionId: 's' },
      b: { agentId: 'other' },
    })
    expect(tabs[1]?.agentByPane).toEqual({ a: { agentId: 'claude' } })
    expect(remapAgentResultContextIds(
      ['iaterminal:result:claude', 'rules'],
      'claude',
      'fullstack',
    )).toEqual(['iaterminal:result:fullstack', 'rules'])
    expect(remapAgentResultIdsInCatalog(
      [
        {
          id: 'claude',
          provider: 'claude',
          permissionMode: 'auto',
          contextIds: ['iaterminal:result:claude'],
        },
        {
          id: 'qa',
          provider: 'cursor',
          permissionMode: 'ask',
          contextIds: ['iaterminal:result:claude', 'rules'],
        },
      ],
      'claude',
      'fullstack',
    )).toEqual([
      {
        id: 'claude',
        provider: 'claude',
        permissionMode: 'auto',
        contextIds: ['iaterminal:result:fullstack'],
      },
      {
        id: 'qa',
        provider: 'cursor',
        permissionMode: 'ask',
        contextIds: ['iaterminal:result:fullstack', 'rules'],
      },
    ])
    expect(remapAgentResultTabContexts(
      [
        {
          id: 'iaterminal:result:claude',
          name: 'Fullstack',
          fileName: 'results/claude.md',
          kind: 'agentResult',
        },
        {
          id: 'iaterminal:notes:x',
          name: 'Notes',
          fileName: 'x.md',
          kind: 'notes',
        },
      ],
      'claude',
      'fullstack',
    )).toEqual([
      {
        id: 'iaterminal:result:fullstack',
        name: 'Fullstack',
        fileName: 'results/fullstack.md',
        kind: 'agentResult',
      },
      {
        id: 'iaterminal:notes:x',
        name: 'Notes',
        fileName: 'x.md',
        kind: 'notes',
      },
    ])
  })

  describe('capacidades del agente', () => {
    const base = { id: 'backend', provider: 'claude', permissionMode: 'ask' }

    it('sin nativeSkills el campo queda ausente — el llamador lo lee como ninguna', () => {
      const def = parseProjectAgentDefinition(base)
      expect(def?.nativeSkills).toBeUndefined()
    })

    it('acepta enabled con lista de namespaces', () => {
      const def = parseProjectAgentDefinition({
        ...base,
        nativeSkills: { enabled: true, namespaces: ['superpowers', 'ponytail'] },
      })
      expect(def?.nativeSkills).toEqual({ enabled: true, namespaces: ['superpowers', 'ponytail'] })
    })

    it('enabled false descarta los namespaces: no hay allowlist que aplicar', () => {
      const def = parseProjectAgentDefinition({
        ...base,
        nativeSkills: { enabled: false, namespaces: ['superpowers'] },
      })
      expect(def?.nativeSkills).toEqual({ enabled: false })
    })

    it('descarta namespaces que no son strings no vacíos', () => {
      const def = parseProjectAgentDefinition({
        ...base,
        nativeSkills: { enabled: true, namespaces: ['superpowers', '', '  ', 42, null] },
      })
      expect(def?.nativeSkills).toEqual({ enabled: true, namespaces: ['superpowers'] })
    })

    it('deduplica namespaces conservando el orden', () => {
      const def = parseProjectAgentDefinition({
        ...base,
        nativeSkills: { enabled: true, namespaces: ['b', 'a', 'b'] },
      })
      expect(def?.nativeSkills?.namespaces).toEqual(['b', 'a'])
    })

    it('nativeSkills que no es objeto se ignora entero', () => {
      expect(parseProjectAgentDefinition({ ...base, nativeSkills: 'true' })?.nativeSkills)
        .toBeUndefined()
      expect(parseProjectAgentDefinition({ ...base, nativeSkills: { namespaces: ['x'] } })?.nativeSkills)
        .toBeUndefined()
    })

    it('mcpsAllowed filtra vacíos y deduplica; lista vacía no se persiste', () => {
      expect(parseProjectAgentDefinition({ ...base, mcpsAllowed: ['jira', '', 'jira', 'figma'] })?.mcpsAllowed)
        .toEqual(['jira', 'figma'])
      expect(parseProjectAgentDefinition({ ...base, mcpsAllowed: [] })?.mcpsAllowed).toBeUndefined()
      expect(parseProjectAgentDefinition({ ...base, mcpsAllowed: 'jira' })?.mcpsAllowed).toBeUndefined()
    })

    it('el clon no comparte el array de namespaces con el original', () => {
      const source = parseProjectAgentDefinition({
        id: 'backend',
        provider: 'claude',
        permissionMode: 'ask',
        nativeSkills: { enabled: true, namespaces: ['superpowers'] },
        mcpsAllowed: ['jira'],
      })!
      const clone = cloneProjectAgentDefinition(source)
      clone.nativeSkills!.namespaces!.push('ponytail')
      clone.mcpsAllowed!.push('figma')
      expect(source.nativeSkills!.namespaces).toEqual(['superpowers'])
      expect(source.mcpsAllowed).toEqual(['jira'])
    })
  })
})
