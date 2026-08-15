import { describe, expect, it, vi } from 'vitest'
import {
  applyCanonicalContextIdentity,
  canonicalContextFileName,
  canonicalContextId,
  contextDefinitionKey,
  defaultAssignedContextIds,
  extractTabContextUpdates,
  filterTabContextUpdatesByChangedPaths,
  isCanonicalContextId,
  needsContextRediscovery,
  resolveTurnContextsRefreshing,
  normalizeAnnotation,
  resolveTurnContexts,
  suggestSymbolsIdentity,
  isProjectRelativePath,
  synthesizeTabContextFromId,
} from '../tabContext'
import type { TabContext } from '../tabContext'

describe('canonical context identity', () => {
  it('maps creatable kinds to stemmed iaterminal ids and name-derived filenames', () => {
    expect(canonicalContextId('folderTree')).toBe('iaterminal:folderTree:folders')
    expect(canonicalContextId('folderTree', { rootPath: 'src' })).toBe(
      'iaterminal:folderTree:folders-src',
    )
    expect(canonicalContextId('deps')).toBe('iaterminal:deps:dependences')
    expect(canonicalContextId('deps', { name: 'Runtime deps' })).toBe(
      'iaterminal:deps:Runtime-deps',
    )
    expect(canonicalContextId('notes', { fileStem: 'design-language' })).toBe(
      'iaterminal:notes:design-language',
    )
    expect(canonicalContextId('agentResult', { agentId: 'fullstack' })).toBe(
      'iaterminal:result:fullstack',
    )
    expect(canonicalContextFileName('agentResult', { agentId: 'fullstack' })).toBe(
      'results/fullstack.md',
    )
    expect(canonicalContextFileName('folderTree')).toBe('folders.md')
    expect(canonicalContextFileName('deps', { name: 'Runtime deps' })).toBe('Runtime-deps.md')
  })

  it('synthesizes tab contexts from assigned ids before discover catches up', () => {
    expect(synthesizeTabContextFromId('iaterminal:notes:Front-Rules')).toMatchObject({
      id: 'iaterminal:notes:Front-Rules',
      name: 'Front Rules',
      kind: 'notes',
    })
    expect(synthesizeTabContextFromId('iaterminal:result:frontend')).toMatchObject({
      id: 'iaterminal:result:frontend',
      name: 'frontend',
      kind: 'agentResult',
    })
    expect(synthesizeTabContextFromId('rules')).toMatchObject({
      id: 'rules',
      name: 'rules',
      kind: 'notes',
    })
    expect(synthesizeTabContextFromId('iaterminal:wiki')).toMatchObject({
      id: 'iaterminal:wiki',
      kind: 'wiki',
    })
    expect(synthesizeTabContextFromId('iaterminal:folderTree')).toMatchObject({
      id: 'iaterminal:folderTree',
      kind: 'folderTree',
      name: 'folders',
    })
  })

  it('dedupes the same stem, not the same kind alone', () => {
    const a = applyCanonicalContextIdentity({
      id: 'x',
      name: 'folders',
      fileName: 'folders.md',
      kind: 'folderTree',
    })
    const b = applyCanonicalContextIdentity({
      id: 'y',
      name: 'Tree',
      fileName: 'other.md',
      kind: 'folderTree',
    })
    expect(a.id).toBe('iaterminal:folderTree:folders')
    expect(b.id).toBe('iaterminal:folderTree:Tree')
    expect(contextDefinitionKey(a)).not.toBe(contextDefinitionKey(b))
    expect(contextDefinitionKey(a)).toBe(contextDefinitionKey({
      ...a,
      id: 'z',
      name: 'folders',
      fileName: 'folders.md',
    }))
  })

  it('forces creatable fileName from name and rejects legacy short ids', () => {
    const applied = applyCanonicalContextIdentity({
      id: 'iaterminal:deps',
      name: 'Runtime deps',
      fileName: 'dependences.md',
      kind: 'deps',
    })
    expect(applied.id).toBe('iaterminal:deps:Runtime-deps')
    expect(applied.fileName).toBe('Runtime-deps.md')
    expect(isCanonicalContextId({
      id: 'iaterminal:deps',
      kind: 'deps',
      fileName: 'dependences.md',
      name: 'Dependencies',
    })).toBe(false)
    expect(isCanonicalContextId(applied)).toBe(true)
  })

  it('requires exact agentResult id matching results/<agentId>.md stem', () => {
    expect(isCanonicalContextId({
      id: 'iaterminal:result:fullstack',
      kind: 'agentResult',
      fileName: 'results/fullstack.md',
      name: 'fullstack',
    })).toBe(true)
    expect(isCanonicalContextId({
      id: 'iaterminal:result:fullstack',
      kind: 'agentResult',
      fileName: 'results/example2.md',
      name: 'fullstack',
    })).toBe(false)
    expect(isCanonicalContextId({
      id: 'iaterminal:result:example2',
      kind: 'agentResult',
      fileName: 'results/example2.md',
      name: 'fullstack',
    })).toBe(true)
  })
})

describe('defaultAssignedContextIds', () => {
  it('prefers folders and symbols over deps or changelog', () => {
    const ids = defaultAssignedContextIds([
      { id: 'iaterminal:deps:dependences', name: 'dependences', fileName: 'dependences.md', kind: 'deps' },
      { id: 'iaterminal:changelog:changelog', name: 'AI Changelog', fileName: 'changelog.md', kind: 'changelog' },
      { id: 'iaterminal:folderTree:folders', name: 'folders', fileName: 'folders.md', kind: 'folderTree' },
      {
        id: 'iaterminal:symbols:classes-methods',
        name: 'symbols',
        fileName: 'classes-methods.md',
        kind: 'symbols',
      },
      { id: 'iaterminal:readme:readme', name: 'README', fileName: 'readme.md', kind: 'readme' },
    ])

    expect(ids).toEqual([
      'iaterminal:folderTree:folders',
      'iaterminal:symbols:classes-methods',
    ])
  })

  it('assigns every symbols context for monorepos', () => {
    const ids = defaultAssignedContextIds([
      { id: 'iaterminal:folderTree:folders', name: 'folders', fileName: 'folders.md', kind: 'folderTree' },
      {
        id: 'iaterminal:symbols:classes-back',
        name: 'Classes · back',
        fileName: 'classes-back.md',
        kind: 'symbols',
        rootPath: 'back',
      },
      {
        id: 'iaterminal:symbols:classes-front',
        name: 'Classes · front',
        fileName: 'classes-front.md',
        kind: 'symbols',
        rootPath: 'front',
      },
    ])
    expect(ids).toEqual([
      'iaterminal:folderTree:folders',
      'iaterminal:symbols:classes-back',
      'iaterminal:symbols:classes-front',
    ])
  })
})

describe('needsContextRediscovery / resolveTurnContexts', () => {
  const staleDisk = [
    { id: 'iaterminal:folderTree:folders', name: 'folders', fileName: 'folders.md', kind: 'folderTree' as const },
  ]
  const freshDisk = [
    ...staleDisk,
    { id: 'iaterminal:jira:GRAV-412', name: 'GRAV-412', fileName: 'jira/GRAV-412.md', kind: 'jira' as const, issueKey: 'GRAV-412' },
  ]

  it('detecta que un id adjunto todavía no está en el catálogo en memoria', () => {
    expect(needsContextRediscovery(['iaterminal:jira:GRAV-412'], staleDisk)).toBe(true)
    expect(needsContextRediscovery(['iaterminal:jira:GRAV-412'], freshDisk)).toBe(false)
    expect(needsContextRediscovery([], staleDisk)).toBe(false)
  })

  it(
    'reproduce la regresión: sin refrescar el contexto recién materializado se cae del turno; '
    + 'tras refrescar, viaja',
    () => {
      // Justo después de `materializeTabContext`: el .md ya existe en disco,
      // pero el pane todavía tiene el snapshot viejo en memoria.
      expect(resolveTurnContexts([], ['iaterminal:jira:GRAV-412'], staleDisk)).toEqual([])
      // Tras el `refreshDiskContexts()` que dispara `needsContextRediscovery`,
      // el mismo id sí resuelve a contenido real.
      expect(resolveTurnContexts([], ['iaterminal:jira:GRAV-412'], freshDisk)).toEqual([
        freshDisk[1],
      ])
    },
  )

  it('deduplica lo ya asignado en el catálogo con lo adjunto ad-hoc', () => {
    const result = resolveTurnContexts(
      ['iaterminal:folderTree:folders'],
      ['iaterminal:folderTree:folders', 'iaterminal:jira:GRAV-412'],
      freshDisk,
    )
    expect(result).toEqual(freshDisk)
  })
})

describe('resolveTurnContextsRefreshing', () => {
  const staleDisk = [
    { id: 'iaterminal:folderTree:folders', name: 'folders', fileName: 'folders.md', kind: 'folderTree' as const },
  ]
  const jira = {
    id: 'iaterminal:jira:GRAV-412',
    name: 'GRAV-412',
    fileName: 'jira/GRAV-412.md',
    kind: 'jira' as const,
    issueKey: 'GRAV-412',
  }

  it('un id desconocido dispara el refresco y el contexto acaba viajando', async () => {
    let disk: TabContext[] = [...staleDisk]
    const refresh = vi.fn(async () => { disk = [...staleDisk, jira] })

    const result = await resolveTurnContextsRefreshing([], [jira.id], () => disk, refresh)

    expect(refresh).toHaveBeenCalledTimes(1)
    // El catálogo que cuenta es el de DESPUÉS de refrescar: leerlo antes
    // devolvería el snapshot viejo y el contexto se caería igual.
    expect(result).toEqual([jira])
  })

  it('un id ya conocido NO refresca: una lectura de disco por tecla sería el otro fallo', async () => {
    const disk = [...staleDisk, jira]
    const refresh = vi.fn(async () => {})

    const result = await resolveTurnContextsRefreshing([], [jira.id], () => disk, refresh)

    expect(refresh).not.toHaveBeenCalled()
    expect(result).toEqual([jira])
  })

  it('sin adjuntos ad-hoc tampoco refresca', async () => {
    const refresh = vi.fn(async () => {})
    const result = await resolveTurnContextsRefreshing(
      ['iaterminal:folderTree:folders'],
      [],
      () => staleDisk,
      refresh,
    )
    expect(refresh).not.toHaveBeenCalled()
    expect(result).toEqual(staleDisk)
  })

  it('si el refresco no encuentra nada, el turno sale sin ese contexto pero no lanza', async () => {
    const refresh = vi.fn(async () => {})
    const result = await resolveTurnContextsRefreshing([], [jira.id], () => staleDisk, refresh)
    expect(refresh).toHaveBeenCalledTimes(1)
    expect(result).toEqual([])
  })
})

describe('suggestSymbolsIdentity', () => {
  it('builds a distinct name and file stem from the subfolder', () => {
    expect(suggestSymbolsIdentity('back/src')).toEqual({
      name: 'Classes · back / src',
      fileStem: 'classes-back-src',
    })
    expect(suggestSymbolsIdentity(undefined).fileStem).toBe('classes-methods')
  })
})

describe('extractTabContextUpdates', () => {
  it('extracts a valid folderTree update and hides its protocol fence', () => {
    const result = extractTabContextUpdates(
      'Trabajo terminado.\n```ia-terminal-context\n' +
      '{"id":"ctx-1","kind":"folderTree","annotations":[{"key":"path:src","text":"Código fuente"}]}\n```\n',
    )
    expect(result.visibleText).toBe('Trabajo terminado.')
    expect(result.updates).toEqual([{
      id: 'ctx-1',
      kind: 'folderTree',
      annotations: [{ key: 'path:src', text: 'Código fuente' }],
    }])
  })

  it('extracts annotations updates for any context kind', () => {
    const result = extractTabContextUpdates(
      'Listo.\n```ia-terminal-context\n' +
      JSON.stringify({
        id: 'ctx-symbols',
        kind: 'symbols',
        annotations: [
          { key: 'src/App.tsx#class:App', text: 'Orquesta tabs y paneles' },
          { key: 'bad', text: '' },
        ],
      }) +
      '\n```\n',
    )
    expect(result.visibleText).toBe('Listo.')
    expect(result.updates).toEqual([{
      id: 'ctx-symbols',
      kind: 'symbols',
      annotations: [
        { key: 'src/App.tsx#class:App', text: 'Orquesta tabs y paneles' },
      ],
    }])
  })

  it('ignores malformed fences', () => {
    const result = extractTabContextUpdates(
      'Respuesta\n```ia-terminal-context\n{not-json}\n```',
    )
    expect(result.visibleText).toBe('Respuesta')
    expect(result.updates).toEqual([])
  })

  it('normalizes annotation text to at most 10 words', () => {
    expect(normalizeAnnotation({
      key: 'k',
      text: 'a b c d e f g h i j k l',
    })?.text.split(/\s+/)).toHaveLength(10)
  })

  it('keeps only symbol annotations backed by actually changed files', () => {
    const text = [
      'Listo.',
      '```ia-terminal-context',
      JSON.stringify({
        id: 'symbols',
        kind: 'symbols',
        annotations: [
          { key: 'src/changed.ts#class:Changed', text: 'Cambio real' },
          { key: 'src/untouched.ts#class:Untouched', text: 'Cambio inventado' },
        ],
      }),
      '```',
    ].join('\n')
    const filtered = filterTabContextUpdatesByChangedPaths(
      text,
      ['src/changed.ts'],
      [{
        id: 'symbols',
        name: 'Símbolos',
        fileName: 'symbols.md',
        kind: 'symbols',
        paths: ['src/changed.ts', 'src/untouched.ts'],
      }],
    )

    expect(extractTabContextUpdates(filtered).updates[0]?.annotations).toEqual([
      { key: 'src/changed.ts#class:Changed', text: 'Cambio real' },
    ])
    expect(filtered).not.toContain('untouched')
  })

  it('keeps symbol annotations whose keys already include the rootPath prefix', () => {
    const text = [
      'Listo.',
      '```ia-terminal-context',
      JSON.stringify({
        id: 'symbols',
        kind: 'symbols',
        annotations: [
          { key: 'src/renderer/App.tsx#class:App', text: 'Cambio real' },
          { key: 'src/renderer/Other.tsx#class:Other', text: 'Cambio inventado' },
        ],
      }),
      '```',
    ].join('\n')
    const filtered = filterTabContextUpdatesByChangedPaths(
      text,
      ['src/renderer/App.tsx'],
      [{
        id: 'symbols',
        name: 'Símbolos',
        fileName: 'symbols.md',
        kind: 'symbols',
        rootPath: 'src',
        paths: ['renderer/App.tsx', 'renderer/Other.tsx'],
      }],
    )

    expect(extractTabContextUpdates(filtered).updates[0]?.annotations).toEqual([
      { key: 'src/renderer/App.tsx#class:App', text: 'Cambio real' },
    ])
    expect(filtered).not.toContain('Other')
  })

  it('rejects every annotation when the real turn diff is empty', () => {
    const text = [
      'Sin cambios.',
      '```ia-terminal-context',
      '{"id":"folders","kind":"folderTree","annotations":[{"key":"path:src","text":"Inventado"}]}',
      '```',
    ].join('\n')
    const filtered = filterTabContextUpdatesByChangedPaths(text, [], [{
      id: 'folders',
      name: 'Folders',
      fileName: 'folders.md',
      kind: 'folderTree',
    }])

    expect(extractTabContextUpdates(filtered).updates).toEqual([])
  })
})

describe('isProjectRelativePath', () => {
  it('acepta rutas relativas que se quedan adentro', () => {
    expect(isProjectRelativePath('')).toBe(true)
    expect(isProjectRelativePath('docs')).toBe(true)
    expect(isProjectRelativePath('docs/sheets/user-stories.xlsx')).toBe(true)
    expect(isProjectRelativePath('./docs')).toBe(true)
  })

  it('rechaza absolutas y escapes', () => {
    expect(isProjectRelativePath('/Users/x/Downloads')).toBe(false)
    expect(isProjectRelativePath('C:\\Users\\x')).toBe(false)
    expect(isProjectRelativePath('../fuera')).toBe(false)
    expect(isProjectRelativePath('docs/../../fuera')).toBe(false)
  })
})
