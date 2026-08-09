import { describe, expect, it } from 'vitest'
import type { TabSession } from '@shared/tabSession'
import { covenantWorkspaceCatalogKey } from '@shared/covenantTypes'
import { resolveTabAgentMeta, syncTabAgentsFromCatalog } from '../projectAgentsStore'

function baseTab(partial: Partial<TabSession> = {}): TabSession {
  return {
    id: 't1',
    title: 'T',
    paneIds: [],
    activePaneId: '',
    ...partial,
  }
}

describe('syncTabAgentsFromCatalog', () => {
  it('creates agent panes from catalog and drops local-only agents', () => {
    let n = 0
    const result = syncTabAgentsFromCatalog(
      baseTab({
        projectFolder: '/proj',
        paneIds: ['term-1', 'old-agent'],
        activePaneId: 'old-agent',
        paneKinds: { 'term-1': 'terminal', 'old-agent': 'agent' },
        agentByPane: {
          'old-agent': { agentId: 'gone', cliSessionId: 'x' },
        },
      }),
      [
        { id: 'qa', provider: 'cursor', permissionMode: 'auto', name: 'qa' },
        { id: 'example2', provider: 'cursor', permissionMode: 'auto', name: 'example2' },
      ],
      {
        maxPanes: 10,
        createPaneId: () => `new-${++n}`,
        createWindow: () => ({ open: false, fullscreen: false, zIndex: 1 }),
      },
    )

    expect(result.changed).toBe(true)
    expect(result.removedPaneIds).toEqual(['old-agent'])
    expect(result.addedPaneIds).toEqual(['new-1', 'new-2'])
    expect(result.tab.paneIds).toEqual(['term-1', 'new-1', 'new-2'])
    expect(result.tab.agentByPane).toEqual({
      'new-1': { agentId: 'qa' },
      'new-2': { agentId: 'example2' },
    })
    expect(result.tab.paneKinds?.['term-1']).toBe('terminal')
  })

  it('reuses pane ids and cliSessionId when agentId already exists', () => {
    const result = syncTabAgentsFromCatalog(
      baseTab({
        paneIds: ['a-qa'],
        activePaneId: 'a-qa',
        paneKinds: { 'a-qa': 'agent' },
        agentByPane: {
          'a-qa': { agentId: 'qa', cliSessionId: 'sess-1' },
        },
        paneWindows: {
          'a-qa': { open: true, fullscreen: false, zIndex: 3 },
        },
      }),
      [{ id: 'qa', provider: 'claude', permissionMode: 'auto' }],
      {
        maxPanes: 10,
        createPaneId: () => 'should-not-run',
        createWindow: () => ({ open: false, fullscreen: false, zIndex: 1 }),
      },
    )

    expect(result.changed).toBe(false)
    expect(result.addedPaneIds).toEqual([])
    expect(result.removedPaneIds).toEqual([])
    expect(result.tab.paneIds).toEqual(['a-qa'])
    expect(result.tab.agentByPane?.['a-qa']).toEqual({
      agentId: 'qa',
      cliSessionId: 'sess-1',
    })
  })

  it('preserves session agent order instead of catalog file order', () => {
    const result = syncTabAgentsFromCatalog(
      baseTab({
        paneIds: ['term-1', 'pane-b', 'pane-a'],
        activePaneId: 'pane-b',
        paneKinds: {
          'term-1': 'terminal',
          'pane-a': 'agent',
          'pane-b': 'agent',
        },
        agentByPane: {
          'pane-a': { agentId: 'alpha' },
          'pane-b': { agentId: 'beta' },
        },
      }),
      [
        { id: 'alpha', provider: 'cursor', permissionMode: 'auto', name: 'alpha' },
        { id: 'beta', provider: 'cursor', permissionMode: 'auto', name: 'beta' },
      ],
      {
        maxPanes: 10,
        createPaneId: () => 'should-not-run',
        createWindow: () => ({ open: false, fullscreen: false, zIndex: 1 }),
      },
    )

    expect(result.changed).toBe(false)
    expect(result.tab.paneIds).toEqual(['term-1', 'pane-b', 'pane-a'])
    expect(result.tab.agentByPane).toEqual({
      'pane-b': { agentId: 'beta' },
      'pane-a': { agentId: 'alpha' },
    })
  })

  it('appends newly catalogued agents after the preserved order', () => {
    let n = 0
    const result = syncTabAgentsFromCatalog(
      baseTab({
        paneIds: ['pane-b', 'pane-a'],
        activePaneId: 'pane-b',
        paneKinds: { 'pane-a': 'agent', 'pane-b': 'agent' },
        agentByPane: {
          'pane-a': { agentId: 'alpha' },
          'pane-b': { agentId: 'beta' },
        },
      }),
      [
        { id: 'alpha', provider: 'cursor', permissionMode: 'auto', name: 'alpha' },
        { id: 'beta', provider: 'cursor', permissionMode: 'auto', name: 'beta' },
        { id: 'gamma', provider: 'cursor', permissionMode: 'auto', name: 'gamma' },
      ],
      {
        maxPanes: 10,
        createPaneId: () => `new-${++n}`,
        createWindow: () => ({ open: false, fullscreen: false, zIndex: 1 }),
      },
    )

    expect(result.changed).toBe(true)
    expect(result.addedPaneIds).toEqual(['new-1'])
    expect(result.tab.paneIds).toEqual(['pane-b', 'pane-a', 'new-1'])
    expect(result.tab.agentByPane?.['new-1']).toEqual({ agentId: 'gamma' })
  })
})

describe('resolveTabAgentMeta org (TAREA 0 timing)', () => {
  it('catálogo vacío → fallback sin name; mismo agentId con catálogo → name real', () => {
    const catalogKey = covenantWorkspaceCatalogKey('acme', 'ws-1')
    const tab = baseTab({
      projectFolder: '/tmp/x',
      orgWorkspace: { slug: 'acme', workspaceId: 'ws-1' },
      paneIds: ['p1'],
      activePaneId: 'p1',
      paneKinds: { p1: 'agent' },
      agentByPane: { p1: { agentId: 'fullstack' } },
    })

    const empty = resolveTabAgentMeta(tab, 'p1', {})
    expect(empty.name).toBeUndefined()
    expect(empty.provider).toBe('claude')

    const seeded = resolveTabAgentMeta(tab, 'p1', {
      [catalogKey]: [{
        id: 'fullstack',
        name: 'Fullstack',
        provider: 'claude',
        permissionMode: 'auto',
      }],
    })
    expect(seeded.name).toBe('Fullstack')
    expect(seeded.id).toBe('fullstack')
  })
})
