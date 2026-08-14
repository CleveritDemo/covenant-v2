import { describe, it, expect } from 'vitest'
import type { TabContext, TabContextKind } from '../tabContext'
import {
  contextGroupId,
  contextUsageByAgent,
  filterAgentContexts,
  groupAgentContexts,
} from '../agentContextPicker'

const ctx = (id: string, kind: TabContextKind, name = id): TabContext => ({
  id, name, fileName: `${id}.md`, kind,
})

const CONTEXTS = [
  ctx('about', 'notes', 'About'),
  ctx('design', 'notes', 'Design Language'),
  ctx('back-cm', 'symbols', 'Back CM'),
  ctx('back-folders', 'folderTree', 'Back Folders'),
  ctx('cristian', 'agentResult', 'Cristian'),
]

describe('contextGroupId', () => {
  it('reparte los kinds en los cuatro cubos', () => {
    expect(contextGroupId('notes')).toBe('markdown')
    expect(contextGroupId('symbols')).toBe('code')
    expect(contextGroupId('git')).toBe('repo')
    expect(contextGroupId('agentResult')).toBe('results')
  })
})

describe('contextUsageByAgent', () => {
  const agents = [
    { id: 'maria', name: 'Maria', contextIds: ['about'] },
    { id: 'cristian', name: 'Cristian Soto', contextIds: ['about', 'back-cm'] },
    { id: 'rodrigo', name: 'Rodrigo', monogram: 'ro', contextIds: ['back-cm'] },
  ]

  it('excluye al agente que se está editando', () => {
    const usage = contextUsageByAgent(agents, 'maria')
    expect(usage.get('about')?.map(u => u.id)).toEqual(['cristian'])
  })

  it('deriva monogramas y respeta el explícito en mayúsculas', () => {
    const usage = contextUsageByAgent(agents, 'maria')
    expect(usage.get('back-cm')?.map(u => u.monogram)).toEqual(['CS', 'RO'])
  })
})

describe('filterAgentContexts', () => {
  const usage = contextUsageByAgent([{ id: 'cristian', contextIds: ['about'] }])

  it('busca por nombre y por archivo', () => {
    expect(filterAgentContexts(CONTEXTS, { query: 'back' }, usage).map(c => c.id))
      .toEqual(['back-cm', 'back-folders'])
    expect(filterAgentContexts(CONTEXTS, { query: 'design.md' }, usage).map(c => c.id))
      .toEqual(['design'])
  })

  it('filtra por grupo', () => {
    expect(filterAgentContexts(CONTEXTS, { group: 'markdown' }, usage).map(c => c.id))
      .toEqual(['about', 'design'])
  })

  it('«sin usar» ignora el grupo y descarta lo seleccionado y lo usado por otros', () => {
    const ids = filterAgentContexts(CONTEXTS, { group: 'code', onlyUnused: true }, usage, ['design'])
      .map(c => c.id)
    expect(ids).toEqual(['back-cm', 'back-folders', 'cristian'])
  })
})

describe('groupAgentContexts', () => {
  it('agrupa en orden fijo, cuenta lo seleccionado y omite cubos vacíos', () => {
    const groups = groupAgentContexts(CONTEXTS, ['about', 'back-cm'])
    expect(groups.map(g => g.id)).toEqual(['markdown', 'code', 'repo', 'results'])
    expect(groups.map(g => g.selected)).toEqual([1, 1, 0, 0])
    expect(groupAgentContexts([ctx('a', 'notes')])).toHaveLength(1)
  })
})
