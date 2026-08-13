import { describe, expect, it } from 'vitest'
import type { ProjectAgentDefinition } from '../projectAgentCatalog'
import type { TabContext } from '../tabContext'
import {
  agentsAssignableToContext,
  agentsUsingContext,
  filterTabContexts,
  presentContextKinds,
  toggleAgentContextId,
  unusedContextCount,
} from '../tabContextAgentUsage'

const context = (id: string, name: string, kind: TabContext['kind'] = 'notes'): TabContext => ({
  id,
  name,
  fileName: `${name.replace(/\s+/g, '-')}.md`,
  kind,
})

const agent = (id: string, contextIds?: string[]): ProjectAgentDefinition => ({
  id,
  provider: 'cursor',
  permissionMode: 'auto',
  ...(contextIds ? { contextIds } : {}),
})

const CONTEXTS: TabContext[] = [
  context('c:folders', 'Folders', 'folderTree'),
  context('c:rules', 'Front Rules'),
  context('c:orphan', 'Deisgn Language'),
  context('iaterminal:result:qa', 'QA', 'agentResult'),
]

const AGENTS: ProjectAgentDefinition[] = [
  agent('fullstack', ['c:folders', 'c:rules']),
  agent('qa', ['c:folders']),
  agent('tl'),
]

describe('agentsUsingContext', () => {
  it('lists the agents that load the context', () => {
    expect(agentsUsingContext(AGENTS, 'c:folders').map(a => a.id)).toEqual(['fullstack', 'qa'])
    expect(agentsUsingContext(AGENTS, 'c:orphan')).toEqual([])
  })
})

describe('filterTabContexts', () => {
  it('returns everything with the default filter', () => {
    const all = filterTabContexts(CONTEXTS, AGENTS, { agent: 'all', kind: 'all', query: '' })
    expect(all).toHaveLength(CONTEXTS.length)
  })

  it('filters by agent', () => {
    const mine = filterTabContexts(CONTEXTS, AGENTS, { agent: 'qa', kind: 'all', query: '' })
    expect(mine.map(c => c.id)).toEqual(['c:folders'])
  })

  it('filters by unused', () => {
    const unused = filterTabContexts(CONTEXTS, AGENTS, { agent: 'unused', kind: 'all', query: '' })
    expect(unused.map(c => c.id)).toEqual(['c:orphan', 'iaterminal:result:qa'])
    expect(unusedContextCount(CONTEXTS, AGENTS)).toBe(2)
  })

  it('matches the query against name and file name', () => {
    const byName = filterTabContexts(CONTEXTS, AGENTS, { agent: 'all', kind: 'all', query: 'rules' })
    expect(byName.map(c => c.id)).toEqual(['c:rules'])
    const byFile = filterTabContexts(CONTEXTS, AGENTS, {
      agent: 'all', kind: 'all', query: 'front-rules.md',
    })
    expect(byFile.map(c => c.id)).toEqual(['c:rules'])
  })

  it('combines kind, query and agent', () => {
    const combined = filterTabContexts(CONTEXTS, AGENTS, {
      agent: 'fullstack', kind: 'folderTree', query: 'fold',
    })
    expect(combined.map(c => c.id)).toEqual(['c:folders'])
    const empty = filterTabContexts(CONTEXTS, AGENTS, {
      agent: 'qa', kind: 'notes', query: '',
    })
    expect(empty).toEqual([])
  })
})

describe('toggleAgentContextId', () => {
  it('adds the id when missing', () => {
    expect(toggleAgentContextId(agent('qa', ['c:folders']), 'c:rules').contextIds)
      .toEqual(['c:folders', 'c:rules'])
    expect(toggleAgentContextId(agent('tl'), 'c:rules').contextIds).toEqual(['c:rules'])
  })

  it('removes the id when present and drops the empty key', () => {
    expect(toggleAgentContextId(agent('qa', ['c:folders', 'c:rules']), 'c:folders').contextIds)
      .toEqual(['c:rules'])
    expect(toggleAgentContextId(agent('qa', ['c:folders']), 'c:folders'))
      .not.toHaveProperty('contextIds')
  })
})

describe('agentsAssignableToContext', () => {
  it('keeps every agent for a project context', () => {
    expect(agentsAssignableToContext(AGENTS, CONTEXTS[0])).toHaveLength(AGENTS.length)
  })

  it('drops the owner of an agent result', () => {
    const owned = agentsAssignableToContext(AGENTS, CONTEXTS[3]).map(a => a.id)
    expect(owned).toEqual(['fullstack', 'tl'])
  })
})

describe('presentContextKinds', () => {
  it('dedupes in first-seen order', () => {
    expect(presentContextKinds(CONTEXTS)).toEqual(['folderTree', 'notes', 'agentResult'])
  })
})
