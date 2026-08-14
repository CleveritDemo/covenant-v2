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
  formatCatalogAgentDelegationLabel,
  isAgentOwnResultContext,
  agentResultContextIdForSlug,
  tabContextForAgentResult,
  withCatalogAgentResultContexts,
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

  it('synthesizes agentResult contexts from the live agent catalog', () => {
    const notes = {
      id: 'iaterminal:notes:x',
      name: 'Notes',
      fileName: 'x.md',
      kind: 'notes' as const,
    }
    const orphan = {
      id: 'iaterminal:result:gone',
      name: 'Gone',
      fileName: 'results/gone.md',
      kind: 'agentResult' as const,
    }
    const agents = [
      { id: 'qa', provider: 'cursor' as const, permissionMode: 'auto' as const, name: 'QA' },
      { id: 'fullstack', provider: 'claude' as const, permissionMode: 'auto' as const, name: 'Full Stack' },
    ]
    const merged = withCatalogAgentResultContexts([notes, orphan], agents)
    expect(merged.filter(c => c.kind !== 'agentResult')).toEqual([notes])
    expect(merged.filter(c => c.kind === 'agentResult').map(c => c.id)).toEqual([
      'iaterminal:result:fullstack',
      'iaterminal:result:qa',
    ])
    expect(tabContextForAgentResult(agents[0])).toMatchObject({
      id: 'iaterminal:result:qa',
      name: 'QA',
      kind: 'agentResult',
    })
  })

  it('migrates legacy ask permissionMode to auto', () => {
    const parsed = parseProjectAgentDefinition({
      id: 'qa',
      provider: 'cursor',
      permissionMode: 'ask',
    })
    expect(parsed?.permissionMode).toBe('auto')
  })

  it('parses and round-trips plane order', () => {
    const parsed = parseProjectAgentDefinition({
      id: 'qa',
      provider: 'cursor',
      permissionMode: 'auto',
      order: 3.9,
      contextIds: ['about'],
    })
    expect(parsed?.order).toBe(3)
    expect(parsed?.contextIds).toEqual(['about'])
    expect(parseProjectAgentDefinition({
      id: 'qa',
      provider: 'cursor',
      permissionMode: 'auto',
      order: -1,
    })?.order).toBeUndefined()
  })

  it('strips own results from parsed contextIds', () => {
    const parsed = parseProjectAgentDefinition({
      id: 'qa',
      provider: 'cursor',
      permissionMode: 'auto',
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
      emitResults: true,
    })
  })

  it('tolera autoImproveContexts legacy en JSON: no rompe y no lo re-persiste', () => {
    const parsed = parseProjectAgentDefinition({
      id: 'legacy',
      provider: 'claude',
      permissionMode: 'auto',
      autoImproveContexts: true,
    })
    expect(parsed).not.toBeNull()
    expect(parsed).not.toHaveProperty('autoImproveContexts')
    expect(cloneProjectAgentDefinition(parsed!)).not.toHaveProperty('autoImproveContexts')
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
      permissionMode: 'auto',
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
    expect(orch?.orchestrationWorkStyle).toBeUndefined()
    const clone = cloneProjectAgentDefinition(orch!)
    expect(clone.coordination).toBe('orchestrator')
    expect(clone.acceptDelegations).toBe(false)
    expect(clone.orchestrationMaxRounds).toBe(7)
    expect(clone.allowExpertReplicas).toBeUndefined()
    expect(clone.orchestrationWorkStyle).toBeUndefined()

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

    const turbo = parseProjectAgentDefinition({
      id: 'boss-turbo',
      provider: 'claude',
      permissionMode: 'auto',
      coordination: 'orchestrator',
      orchestrationWorkStyle: 'turbo',
    })
    expect(turbo).toMatchObject({
      coordination: 'orchestrator',
      orchestrationWorkStyle: 'turbo',
    })
    expect(turbo?.allowExpertReplicas).toBeUndefined()
    const turboClone = cloneProjectAgentDefinition(turbo!)
    expect(turboClone.orchestrationWorkStyle).toBe('turbo')
    expect(turboClone.allowExpertReplicas).toBeUndefined()

    const linearExplicit = parseProjectAgentDefinition({
      id: 'boss-linear',
      provider: 'claude',
      permissionMode: 'auto',
      coordination: 'orchestrator',
      orchestrationWorkStyle: 'linear',
      allowExpertReplicas: true,
    })
    expect(linearExplicit?.orchestrationWorkStyle).toBeUndefined()
    expect(linearExplicit?.allowExpertReplicas).toBe(true)

    const po = parseProjectAgentDefinition({
      id: 'po',
      provider: 'claude',
      permissionMode: 'auto',
      coordination: 'productOwner',
      orchestrationMaxRounds: 5,
      allowExpertReplicas: true,
      orchestrationWorkStyle: 'turbo',
    })
    expect(po).toMatchObject({
      coordination: 'productOwner',
      orchestrationMaxRounds: 5,
      allowExpertReplicas: true,
    })
    expect(po?.orchestrationWorkStyle).toBeUndefined()
    const poClone = cloneProjectAgentDefinition(po!)
    expect(poClone.coordination).toBe('productOwner')
    expect(poClone.orchestrationMaxRounds).toBe(5)
    expect(poClone.allowExpertReplicas).toBeUndefined()
    expect(poClone.orchestrationWorkStyle).toBeUndefined()

    const specialist = parseProjectAgentDefinition({
      id: 'qa',
      provider: 'claude',
      permissionMode: 'auto',
      allowExpertReplicas: true,
      orchestrationWorkStyle: 'turbo',
    })
    expect(specialist?.allowExpertReplicas).toBeUndefined()
    expect(specialist?.orchestrationWorkStyle).toBeUndefined()
  })

  it('keeps empty rule drafts so the editor can add slots', () => {
    const parsed = parseProjectAgentDefinition({
      id: 'draft',
      provider: 'claude',
      permissionMode: 'auto',
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
    // El `cliSessionId` suelto de una sesión vieja se convierte en el thread inicial.
    expect(parseAgentPaneBinding({ agentId: 'qa', cliSessionId: ' sess ' })).toEqual({
      agentId: 'qa',
      activeThreadId: 't1',
      threads: [{ id: 't1', title: '', updatedAt: 0, cliSessionId: 'sess' }],
    })
  })

  it('proyecta el cliSessionId del thread activo en ambos sentidos', () => {
    const binding = parseAgentPaneBinding({
      agentId: 'qa',
      activeThreadId: 'a',
      threads: [
        { id: 'a', title: 'vieja', updatedAt: 1, cliSessionId: 'sess-a' },
        { id: 'b', title: 'nueva', updatedAt: 2, cliSessionId: 'sess-b' },
      ],
    })!
    expect(resolveAgentPaneMeta(binding, undefined).cliSessionId).toBe('sess-a')

    // Cambiar de thread reanuda la sesión de ese thread, no la anterior.
    const switched = resolveAgentPaneMeta({ ...binding, activeThreadId: 'b' }, undefined)
    expect(switched.cliSessionId).toBe('sess-b')

    // Lo que el pane escriba en meta manda sobre el thread activo…
    const written = agentBindingFromMeta({ ...switched, cliSessionId: 'sess-b2' })
    expect(written.threads?.find(thread => thread.id === 'b')?.cliSessionId).toBe('sess-b2')
    // …y no toca la sesión de los demás.
    expect(written.threads?.find(thread => thread.id === 'a')?.cliSessionId).toBe('sess-a')
  })

  it('resolves runtime meta and round-trips definition/binding', () => {
    const definition = parseProjectAgentDefinition({
      id: 'qa',
      provider: 'cursor',
      permissionMode: 'auto',
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
      activeThreadId: 't1',
      threads: [{ id: 't1', title: '', updatedAt: 0, cliSessionId: 'cli-1' }],
    })
    expect(cloneProjectAgentDefinition(definition, ' (copy)').name).toBe('qa (copy)')
    expect(cloneProjectAgentDefinition({
      id: 'legacy',
      provider: 'claude',
      permissionMode: 'auto',
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

  it('formatCatalogAgentDelegationLabel usa nombre y rol del catálogo', () => {
    const catalog = [
      parseProjectAgentDefinition({
        id: 'frontend',
        provider: 'claude',
        permissionMode: 'auto',
        name: 'David',
        role: 'frontend engineer',
      })!,
      parseProjectAgentDefinition({
        id: 'qa',
        provider: 'claude',
        permissionMode: 'auto',
        name: 'Vanesa',
      })!,
    ]
    expect(formatCatalogAgentDelegationLabel('frontend', catalog)).toBe('David · frontend engineer')
    expect(formatCatalogAgentDelegationLabel('qa', catalog)).toBe('Vanesa')
    expect(formatCatalogAgentDelegationLabel('missing', catalog)).toBe('missing')
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
          permissionMode: 'auto',
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
        permissionMode: 'auto',
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
    const base = { id: 'backend', provider: 'claude', permissionMode: 'auto' }

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
        permissionMode: 'auto',
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

describe('ceremonyRoles — varios sombreros en la ficha', () => {
  it('la ficha antigua de un solo rol se adopta como lista de uno', () => {
    const def = parseProjectAgentDefinition({
      id: 'qa', provider: 'claude', permissionMode: 'plan', ceremonyRole: 'qa',
    })
    expect(def?.ceremonyRoles).toEqual(['qa'])
  })

  it('la lista manda cuando vienen las dos formas', () => {
    const def = parseProjectAgentDefinition({
      id: 'tl',
      provider: 'claude',
      permissionMode: 'plan',
      ceremonyRole: 'qa',
      ceremonyRoles: ['architect', 'dev'],
    })
    expect(def?.ceremonyRoles).toEqual(['architect', 'dev'])
  })

  it('escribe el singular como espejo del primero, para lectores anteriores', () => {
    const def = parseProjectAgentDefinition({
      id: 'tl',
      provider: 'claude',
      permissionMode: 'plan',
      ceremonyRoles: ['architect', 'dev', 'qa'],
    })
    expect(def?.ceremonyRole).toBe('architect')
  })

  it('roles inventados se descartan sin tumbar la ficha', () => {
    const def = parseProjectAgentDefinition({
      id: 'x',
      provider: 'claude',
      permissionMode: 'plan',
      ceremonyRoles: ['qa', 'presidente', 42],
    })
    expect(def?.ceremonyRoles).toEqual(['qa'])
  })

  it('sin roles no se inventa el campo', () => {
    const def = parseProjectAgentDefinition({
      id: 'x', provider: 'claude', permissionMode: 'plan',
    })
    expect(def?.ceremonyRoles).toBeUndefined()
    expect(def?.ceremonyRole).toBeUndefined()
  })
})
