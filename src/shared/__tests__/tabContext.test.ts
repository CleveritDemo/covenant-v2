import { describe, expect, it } from 'vitest'
import {
  defaultAssignedContextIds,
  extractTabContextUpdates,
  filterTabContextUpdatesByChangedPaths,
  normalizeAnnotation,
} from '../tabContext'

describe('defaultAssignedContextIds', () => {
  it('prefers folders and symbols over deps or changelog', () => {
    const ids = defaultAssignedContextIds([
      { id: '2601e189', name: 'dependences', fileName: 'dependences.md', kind: 'deps' },
      { id: 'iaterminal:changelog', name: 'AI Changelog', fileName: 'changelog.md', kind: 'changelog' },
      { id: 'discovered-file:folders.md', name: 'folders', fileName: 'folders.md', kind: 'folderTree' },
      {
        id: 'discovered-file:classes-methods-variables.md',
        name: 'symbols',
        fileName: 'classes-methods-variables.md',
        kind: 'symbols',
      },
      { id: 'readme-1', name: 'README', fileName: 'readme.md', kind: 'readme' },
    ])

    expect(ids).toEqual([
      'discovered-file:folders.md',
      'discovered-file:classes-methods-variables.md',
    ])
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
