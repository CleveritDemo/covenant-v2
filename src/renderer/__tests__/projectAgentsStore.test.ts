import { describe, expect, it } from 'vitest'
import type { TabSession } from '@shared/tabSession'
import {
  mergeRemoteAgentsWithLocalOnly,
  resolveTabAgentMeta,
  syncTabAgentsFromCatalog,
} from '../projectAgentsStore'

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

  it('remote catalog order → panes; keeps local pane order for existing agents', () => {
    let n = 0
    const kept = syncTabAgentsFromCatalog(
      baseTab({
        paneIds: ['a-fe', 'a-qa'],
        activePaneId: 'a-qa',
        paneKinds: { 'a-fe': 'agent', 'a-qa': 'agent' },
        agentByPane: {
          'a-fe': { agentId: 'frontend' },
          'a-qa': { agentId: 'qa' },
        },
      }),
      [
        { id: 'qa', provider: 'claude', permissionMode: 'auto', order: 0 },
        { id: 'frontend', provider: 'claude', permissionMode: 'auto', order: 1 },
        { id: 'backend', provider: 'claude', permissionMode: 'auto', order: 2 },
      ],
      {
        maxPanes: 10,
        createPaneId: () => `new-${++n}`,
        createWindow: () => ({ open: false, fullscreen: false, zIndex: 1 }),
      },
    )
    expect(kept.tab.paneIds).toEqual(['a-fe', 'a-qa', 'new-1'])
    expect(kept.tab.agentByPane?.['a-fe']?.agentId).toBe('frontend')
    expect(kept.tab.agentByPane?.['a-qa']?.agentId).toBe('qa')
    expect(kept.tab.agentByPane?.['new-1']?.agentId).toBe('backend')

    const fresh = syncTabAgentsFromCatalog(
      baseTab({ paneIds: [], activePaneId: '' }),
      [
        { id: 'qa', provider: 'claude', permissionMode: 'auto', order: 0 },
        { id: 'frontend', provider: 'claude', permissionMode: 'auto', order: 1 },
        { id: 'backend', provider: 'claude', permissionMode: 'auto', order: 2 },
      ],
      {
        maxPanes: 10,
        createPaneId: () => `new-${++n}`,
        createWindow: () => ({ open: false, fullscreen: false, zIndex: 1 }),
      },
    )
    expect(fresh.tab.agentByPane?.['new-2']?.agentId).toBe('qa')
    expect(fresh.tab.agentByPane?.['new-3']?.agentId).toBe('frontend')
    expect(fresh.tab.agentByPane?.['new-4']?.agentId).toBe('backend')
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

  it('preserves thread cliSessionId on catalog sync by default (org resume in memory)', () => {
    const result = syncTabAgentsFromCatalog(
      baseTab({
        paneIds: ['a-qa'],
        activePaneId: 'a-qa',
        paneKinds: { 'a-qa': 'agent' },
        orgWorkspace: { slug: 'acme', workspaceId: 'ws-1' },
        agentByPane: {
          'a-qa': {
            agentId: 'qa',
            activeThreadId: 't1',
            threads: [{ id: 't1', title: 'panel', updatedAt: 5, cliSessionId: 'cursor-sess' }],
          },
        },
        paneWindows: {
          'a-qa': { open: true, fullscreen: false, zIndex: 3 },
        },
      }),
      [{ id: 'qa', provider: 'cursor', permissionMode: 'auto' }],
      {
        maxPanes: 10,
        createPaneId: () => 'should-not-run',
        createWindow: () => ({ open: false, fullscreen: false, zIndex: 1 }),
      },
    )

    expect(result.changed).toBe(false)
    expect(result.tab.agentByPane?.['a-qa']?.threads?.[0]?.cliSessionId).toBe('cursor-sess')
  })

  it('drops cliSessionId when preserveCliSessionIds is false and marks changed', () => {
    const result = syncTabAgentsFromCatalog(
      baseTab({
        paneIds: ['a-qa'],
        activePaneId: 'a-qa',
        paneKinds: { 'a-qa': 'agent' },
        agentByPane: {
          'a-qa': { agentId: 'qa', cliSessionId: 'sess-1', localOnly: true },
        },
        paneWindows: {
          'a-qa': { open: true, fullscreen: false, zIndex: 3 },
        },
      }),
      [{
        id: 'qa',
        provider: 'claude',
        permissionMode: 'auto',
        localOnly: true,
      }],
      {
        maxPanes: 10,
        createPaneId: () => 'should-not-run',
        createWindow: () => ({ open: false, fullscreen: false, zIndex: 1 }),
        preserveCliSessionIds: false,
      },
    )

    expect(result.changed).toBe(true)
    expect(result.addedPaneIds).toEqual([])
    expect(result.removedPaneIds).toEqual([])
    expect(result.tab.agentByPane?.['a-qa']).toEqual({
      agentId: 'qa',
      localOnly: true,
    })
    expect(result.tab.agentByPane?.['a-qa']).not.toHaveProperty('cliSessionId')
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

  it('preserves localOnly replica bindings when present in the merged catalog', () => {
    const result = syncTabAgentsFromCatalog(
      baseTab({
        paneIds: ['pane-base', 'pane-replica'],
        activePaneId: 'pane-replica',
        paneKinds: { 'pane-base': 'agent', 'pane-replica': 'agent' },
        agentByPane: {
          'pane-base': { agentId: 'frontend' },
          'pane-replica': { agentId: 'frontend-2', localOnly: true },
        },
      }),
      [
        { id: 'frontend', provider: 'cursor', permissionMode: 'auto', name: 'Frontend' },
        {
          id: 'frontend-2',
          provider: 'cursor',
          permissionMode: 'auto',
          name: 'Frontend (replica)',
          localOnly: true,
        },
      ],
      {
        maxPanes: 10,
        createPaneId: () => 'should-not-run',
        createWindow: () => ({ open: false, fullscreen: false, zIndex: 1 }),
      },
    )

    expect(result.removedPaneIds).toEqual([])
    expect(result.tab.agentByPane?.['pane-replica']).toEqual({
      agentId: 'frontend-2',
      localOnly: true,
    })
  })
})

describe('mergeRemoteAgentsWithLocalOnly', () => {
  it('keeps org backend agents and session-local replicas without syncing them remotely', () => {
    const merged = mergeRemoteAgentsWithLocalOnly(
      [{ id: 'frontend', provider: 'cursor', permissionMode: 'auto', name: 'Frontend' }],
      [
        { id: 'frontend', provider: 'cursor', permissionMode: 'auto', name: 'Old Frontend' },
        {
          id: 'frontend-2',
          provider: 'cursor',
          permissionMode: 'auto',
          name: 'Frontend (replica)',
          localOnly: true,
        },
      ],
    )

    expect(merged.map(agent => agent.id)).toEqual(['frontend', 'frontend-2'])
    expect(merged.find(agent => agent.id === 'frontend')?.name).toBe('Frontend')
    expect(merged.find(agent => agent.id === 'frontend-2')?.localOnly).toBe(true)
  })
})

describe('resolveTabAgentMeta org (TAREA 0 timing)', () => {
  it('catálogo vacío → fallback sin name; mismo agentId con catálogo → name real', () => {
    const catalogKey = '/tmp/x'
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
