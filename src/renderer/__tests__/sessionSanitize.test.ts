import { describe, expect, it } from 'vitest'
import { deriveTabCounter, sanitizePersistedSession } from '../sessionSanitize'
import type { TabSession } from '../App'

function tab(id: string, paneId: string, title = 'Terminal 1'): TabSession {
  return { id, title, paneIds: [paneId], activePaneId: paneId }
}

describe('sanitizePersistedSession', () => {
  it('keeps tabs with empty paneIds (agentic plane)', () => {
    const result = sanitizePersistedSession({
      version: 1,
      activeTabId: 't2',
      tabs: [
        tab('t1', 'p1'),
        { id: 't2', title: 'Empty', paneIds: [], activePaneId: '' },
      ],
      cwds: {},
    })
    expect(result?.tabs).toHaveLength(2)
    expect(result?.activeTabId).toBe('t2')
    expect(result?.tabs[1]?.paneIds).toEqual([])
    expect(result?.tabs[1]?.paneWindows).toBeUndefined()
  })

  it('migrates missing paneWindows for existing panes', () => {
    const result = sanitizePersistedSession({
      version: 1,
      activeTabId: 't1',
      tabs: [tab('t1', 'p1')],
      cwds: {},
    })
    expect(result?.tabs[0]?.paneWindows?.p1).toMatchObject({
      open: false,
      fullscreen: false,
      zIndex: expect.any(Number),
    })
    expect(result?.tabs[0]?.paneWindows?.p1).not.toHaveProperty('width')
    expect(result?.tabs[0]).not.toHaveProperty('panePlaneNodes')
  })

  it('collapses pane windows on load and strips legacy plane node positions', () => {
    const result = sanitizePersistedSession({
      version: 1,
      activeTabId: 't1',
      tabs: [{
        id: 't1',
        title: 'Plane',
        paneIds: ['mini', 'full'],
        activePaneId: 'full',
        paneWindows: {
          mini: {
            open: false,
            fullscreen: true,
            zIndex: 1,
            x: 80,
            y: 90,
            width: 500,
            height: 360,
          },
          full: {
            open: true,
            fullscreen: true,
            zIndex: 4,
            x: 10,
            y: 20,
            width: 700,
            height: 480,
          },
        } as TabSession['paneWindows'],
        panePlaneNodes: {
          mini: { x: 40, y: 50 },
          full: { x: 260, y: 120 },
        },
      } as TabSession],
      cwds: {},
    })
    expect(result?.tabs[0]?.paneWindows?.mini).toEqual({
      open: false,
      fullscreen: false,
      zIndex: 1,
    })
    expect(result?.tabs[0]?.paneWindows?.full).toEqual({
      open: false,
      fullscreen: false,
      zIndex: 4,
    })
    expect(result?.tabs[0]).not.toHaveProperty('panePlaneNodes')
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
            name: '  Architect  ',
          },
        },
      }],
      cwds: {},
    })

    expect(result?.tabs[0]?.agentByPane?.agent?.model).toBe('opus')
    expect(result?.tabs[0]?.agentByPane?.agent?.name).toBe('Architect')
  })

  it('round-trips agent name and config across sanitize reload', () => {
    const once = sanitizePersistedSession({
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
            provider: 'cursor',
            permissionMode: 'auto',
            name: 'Deploy Bot',
            role: 'Release engineer',
            objective: 'Keep deploys green',
            model: 'gpt-5',
            cliSessionId: 'sess-1',
            contextIds: ['ctx-a'],
            autoImproveContexts: true,
          },
        },
      }],
      cwds: { agent: '/tmp' },
    })
    expect(once).not.toBeNull()
    const again = sanitizePersistedSession({
      version: 1,
      activeTabId: once!.activeTabId,
      tabs: once!.tabs,
      cwds: once!.cwds,
    })
    expect(again?.tabs[0]?.agentByPane?.agent).toEqual({
      provider: 'cursor',
      permissionMode: 'auto',
      name: 'Deploy Bot',
      role: 'Release engineer',
      objective: 'Keep deploys green',
      model: 'gpt-5',
      cliSessionId: 'sess-1',
      contextIds: ['ctx-a'],
      autoImproveContexts: true,
    })
  })

  it('trims and clamps agent role and objective', () => {
    const longRole = `  ${'R'.repeat(100)}  `
    const longObjective = `  ${'O'.repeat(600)}  `
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
            role: longRole,
            objective: longObjective,
          },
        },
      }],
      cwds: {},
    })

    expect(result?.tabs[0]?.agentByPane?.agent?.role).toBe('R'.repeat(80))
    expect(result?.tabs[0]?.agentByPane?.agent?.objective).toBe('O'.repeat(500))
  })

  it('persists projectFolder and migrates it from terminal pane cwds when missing', () => {
    const result = sanitizePersistedSession({
      version: 1,
      activeTabId: 't1',
      tabs: [
        {
          id: 't1',
          title: 'With folder',
          paneIds: ['p1'],
          activePaneId: 'p1',
          projectFolder: '/Users/me/project',
        },
        {
          id: 't2',
          title: 'Legacy',
          paneIds: ['agent', 'term'],
          activePaneId: 'agent',
          paneKinds: { agent: 'agent' },
          projectFolder: null as unknown as undefined,
        },
      ],
      cwds: {
        p1: '/Users/me/project',
        agent: '/Users/me',
        term: '/Users/me/legacy/front',
      },
    })

    expect(result?.tabs[0]?.projectFolder).toBe('/Users/me/project')
    // Prefiere terminal sobre agente.
    expect(result?.tabs[1]?.projectFolder).toBe('/Users/me/legacy/front')
  })

  it('omits empty projectFolder instead of writing null', () => {
    const result = sanitizePersistedSession({
      version: 1,
      activeTabId: 't1',
      tabs: [{
        id: 't1',
        title: 'Empty',
        paneIds: [],
        activePaneId: '',
        projectFolder: '   ',
      }],
      cwds: {},
    })

    expect(result?.tabs[0]).not.toHaveProperty('projectFolder')
  })

  it('keeps full agent pane identity across sanitize', () => {
    const result = sanitizePersistedSession({
      version: 1,
      activeTabId: 't1',
      tabs: [{
        id: 't1',
        title: 'Agents',
        paneIds: ['a1'],
        activePaneId: 'a1',
        paneKinds: { a1: 'agent' },
        projectFolder: '/Users/me/app',
        agentByPane: {
          a1: {
            provider: 'cursor',
            permissionMode: 'auto',
            name: 'Scout',
            role: 'explorer',
            objective: 'Map the repo',
            model: 'gpt-5',
            contextIds: ['ctx-1', 'ctx-2'],
            autoImproveContexts: true,
            cliSessionId: 'cli-abc',
          },
        },
      }],
      cwds: { a1: '/Users/me/app' },
    })

    expect(result?.tabs[0]?.projectFolder).toBe('/Users/me/app')
    expect(result?.tabs[0]?.agentByPane?.a1).toEqual({
      provider: 'cursor',
      permissionMode: 'auto',
      name: 'Scout',
      role: 'explorer',
      objective: 'Map the repo',
      model: 'gpt-5',
      contextIds: ['ctx-1', 'ctx-2'],
      autoImproveContexts: true,
      cliSessionId: 'cli-abc',
    })
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
