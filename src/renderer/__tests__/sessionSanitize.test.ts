import { describe, expect, it } from 'vitest'
import { deriveTabCounter, sanitizePersistedSession } from '../sessionSanitize'
import type { TabSession } from '../App'

function tab(id: string, paneId: string, title = 'Terminal 1'): TabSession {
  return { id, title, paneIds: [paneId], activePaneId: paneId }
}

describe('sanitizePersistedSession', () => {
  it('filters tabs with empty paneIds', () => {
    const result = sanitizePersistedSession({
      version: 1,
      activeTabId: 't1',
      tabs: [
        tab('t1', 'p1'),
        { id: 't2', title: 'Empty', paneIds: [], activePaneId: '' },
      ],
      cwds: {},
    })
    expect(result?.tabs).toHaveLength(1)
    expect(result?.activeTabId).toBe('t1')
  })

  it('falls back activeTabId when invalid', () => {
    const result = sanitizePersistedSession({
      version: 1,
      activeTabId: 'missing',
      tabs: [tab('t1', 'p1'), tab('t2', 'p2', 'Terminal 2')],
      cwds: {},
    })
    expect(result?.activeTabId).toBe('t1')
  })

  it('fixes orphan activePaneId', () => {
    const result = sanitizePersistedSession({
      version: 1,
      activeTabId: 't1',
      tabs: [{ id: 't1', title: 'T', paneIds: ['p1'], activePaneId: 'orphan' }],
      cwds: {},
    })
    expect(result?.tabs[0]?.activePaneId).toBe('p1')
  })

  it('returns null when no valid tabs', () => {
    expect(sanitizePersistedSession({
      version: 1,
      activeTabId: 'x',
      tabs: [],
      cwds: {},
    })).toBeNull()
  })

  it('sanitizes agent pane metadata and keeps legacy panes as terminals', () => {
    const result = sanitizePersistedSession({
      version: 1,
      activeTabId: 't1',
      tabs: [{
        id: 't1',
        title: 'Mixed',
        paneIds: ['terminal', 'agent'],
        activePaneId: 'agent',
        paneKinds: { agent: 'agent' },
        agentByPane: {
          agent: {
            provider: 'cursor',
            permissionMode: 'auto',
            cliSessionId: ' chat-123 ',
          },
        },
      }],
      cwds: { terminal: '/tmp', agent: '/project' },
    })

    expect(result?.tabs[0]?.paneKinds).toEqual({ agent: 'agent' })
    expect(result?.tabs[0]?.agentByPane?.agent).toEqual({
      provider: 'cursor',
      permissionMode: 'auto',
      cliSessionId: 'chat-123',
    })
    expect(result?.tabs[0]?.paneKinds?.terminal).toBeUndefined()
  })

  it('migrates legacy readonly permission mode to plan', () => {
    const result = sanitizePersistedSession({
      version: 1,
      activeTabId: 't1',
      tabs: [{
        id: 't1',
        title: 'Agent',
        paneIds: ['agent'],
        activePaneId: 'agent',
        paneKinds: { agent: 'agent' },
        agentByPane: {
          agent: {
            provider: 'claude',
            permissionMode: 'readonly' as never,
          },
        },
      }],
      cwds: {},
    })

    expect(result?.tabs[0]?.agentByPane?.agent?.permissionMode).toBe('plan')
  })

  it('preserves agent model selection', () => {
    const result = sanitizePersistedSession({
      version: 1,
      activeTabId: 't1',
      tabs: [{
        id: 't1',
        title: 'Agent',
        paneIds: ['agent'],
        activePaneId: 'agent',
        paneKinds: { agent: 'agent' },
        agentByPane: {
          agent: {
            provider: 'claude',
            permissionMode: 'ask',
            model: ' opus ',
          },
        },
      }],
      cwds: {},
    })

    expect(result?.tabs[0]?.agentByPane?.agent?.model).toBe('opus')
  })

  it('keeps assigned context ids without persisting the tab catalog', () => {
    const result = sanitizePersistedSession({
      version: 1,
      activeTabId: 't1',
      tabs: [{
        id: 't1',
        title: 'Contexts',
        paneIds: ['agent'],
        activePaneId: 'agent',
        paneKinds: { agent: 'agent' },
        contexts: [
          { id: 'ctx', name: ' Core ', fileName: ' core-files.md ', kind: 'files', paths: [' src/App.tsx '] },
        ],
        agentByPane: {
          agent: {
            provider: 'cursor',
            permissionMode: 'ask',
            contextIds: ['ctx', 'missing'],
            autoImproveContexts: true,
          },
        },
      }],
      cwds: {},
    })

    expect(result?.tabs[0]?.contexts).toBeUndefined()
    expect(result?.tabs[0]?.agentByPane?.agent?.contextIds).toEqual(['ctx', 'missing'])
    expect(result?.tabs[0]?.agentByPane?.agent?.autoImproveContexts).toBe(true)
  })
})

describe('deriveTabCounter', () => {
  it('uses max number from titles', () => {
    expect(deriveTabCounter([
      tab('a', 'p1', 'Terminal 2'),
      tab('b', 'p2', 'Terminal 7'),
    ])).toBe(7)
  })
})
