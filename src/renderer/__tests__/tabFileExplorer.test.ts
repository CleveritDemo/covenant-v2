import { describe, expect, it } from 'vitest'
import type { TabSession } from '@shared/tabSession'
import { DEFAULT_FILE_EXPLORER_STATE } from '@shared/fileExplorerPersistedState'
import {
  migrateExplorerStateByTab,
  resolveTabExplorerSessionId,
  resolveTabTerminalPaneId,
} from '../tabFileExplorer'

function tab(partial: Partial<TabSession> & Pick<TabSession, 'id' | 'paneIds' | 'activePaneId'>): TabSession {
  return {
    title: 'Workspace',
    ...partial,
  }
}

describe('resolveTabTerminalPaneId', () => {
  it('prefers the active terminal pane', () => {
    expect(resolveTabTerminalPaneId(tab({
      id: 't1',
      paneIds: ['a1', 'term-2', 'term-1'],
      activePaneId: 'term-2',
      paneKinds: { a1: 'agent', 'term-1': 'terminal', 'term-2': 'terminal' },
    }))).toBe('term-2')
  })

  it('falls back to the first terminal when active is an agent', () => {
    expect(resolveTabTerminalPaneId(tab({
      id: 't1',
      paneIds: ['a1', 'term-1', 'term-2'],
      activePaneId: 'a1',
      paneKinds: { a1: 'agent', 'term-1': 'terminal', 'term-2': 'terminal' },
    }))).toBe('term-1')
  })

  it('returns null when the tab has no terminals', () => {
    expect(resolveTabTerminalPaneId(tab({
      id: 't1',
      paneIds: ['a1'],
      activePaneId: 'a1',
      paneKinds: { a1: 'agent' },
    }))).toBeNull()
  })
})

describe('resolveTabExplorerSessionId', () => {
  it('uses tab-explorer:<tab.id> when projectFolder exists and only agent panes', () => {
    expect(resolveTabExplorerSessionId(tab({
      id: 't1',
      paneIds: ['a1', 'a2'],
      activePaneId: 'a1',
      projectFolder: '/repo',
      paneKinds: { a1: 'agent', a2: 'agent' },
    }))).toBe('tab-explorer:t1')
  })

  it('prefers the terminal pane id when projectFolder and a terminal exist', () => {
    expect(resolveTabExplorerSessionId(tab({
      id: 't1',
      paneIds: ['a1', 'term-2', 'term-1'],
      activePaneId: 'term-2',
      projectFolder: '/repo',
      paneKinds: { a1: 'agent', 'term-1': 'terminal', 'term-2': 'terminal' },
    }))).toBe('term-2')

    expect(resolveTabExplorerSessionId(tab({
      id: 't1',
      paneIds: ['a1', 'term-1', 'term-2'],
      activePaneId: 'a1',
      projectFolder: '/repo',
      paneKinds: { a1: 'agent', 'term-1': 'terminal', 'term-2': 'terminal' },
    }))).toBe('term-1')
  })

  it('returns null without projectFolder even if a terminal exists', () => {
    expect(resolveTabExplorerSessionId(tab({
      id: 't1',
      paneIds: ['term-1'],
      activePaneId: 'term-1',
      paneKinds: { 'term-1': 'terminal' },
    }))).toBeNull()
  })
})

describe('migrateExplorerStateByTab', () => {
  it('keeps explorerByTab when present', () => {
    const result = migrateExplorerStateByTab(
      [tab({ id: 't1', paneIds: ['p1'], activePaneId: 'p1' })],
      {
        t1: {
          ...DEFAULT_FILE_EXPLORER_STATE,
          open: true,
          selectedRelPath: 'src',
          selectedIsDirectory: true,
        },
      },
      { p1: { ...DEFAULT_FILE_EXPLORER_STATE, open: false } },
    )
    expect(result.t1?.open).toBe(true)
    expect(result.t1?.selectedRelPath).toBe('src')
  })

  it('migrates from explorerByPane and opens if any pane was open', () => {
    const result = migrateExplorerStateByTab(
      [tab({
        id: 't1',
        paneIds: ['term-1', 'term-2'],
        activePaneId: 'term-2',
        paneKinds: { 'term-1': 'terminal', 'term-2': 'terminal' },
      })],
      undefined,
      {
        'term-1': {
          ...DEFAULT_FILE_EXPLORER_STATE,
          open: true,
          selectedRelPath: 'a.ts',
        },
        'term-2': {
          ...DEFAULT_FILE_EXPLORER_STATE,
          open: false,
          selectedRelPath: 'b.ts',
        },
      },
    )
    expect(result.t1?.open).toBe(true)
    expect(result.t1?.selectedRelPath).toBe('b.ts')
  })
})
