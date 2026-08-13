import { describe, expect, it } from 'vitest'
import {
  deriveTabCounter,
  sanitizePersistedSession,
  stripOrgTabAgentCliSessionIds,
} from '../sessionSanitize'
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

  it('keeps planeOpenChatAgentId for agents and clears invalid / missing', () => {
    const kept = sanitizePersistedSession({
      version: 1,
      activeTabId: 't1',
      tabs: [{
        id: 't1',
        title: 'Plane',
        paneIds: ['agent-1', 'term-1'],
        activePaneId: 'agent-1',
        paneKinds: { 'agent-1': 'agent', 'term-1': 'terminal' },
        agentByPane: { 'agent-1': { agentId: 'claude' } },
        planeOpenChatAgentId: 'agent-1',
      }],
      cwds: {},
    })
    expect(kept?.tabs[0]?.planeOpenChatAgentId).toBe('agent-1')

    const clearedTerminal = sanitizePersistedSession({
      version: 1,
      activeTabId: 't1',
      tabs: [{
        id: 't1',
        title: 'Plane',
        paneIds: ['agent-1', 'term-1'],
        activePaneId: 'agent-1',
        paneKinds: { 'agent-1': 'agent', 'term-1': 'terminal' },
        agentByPane: { 'agent-1': { agentId: 'claude' } },
        planeOpenChatAgentId: 'term-1',
      }],
      cwds: {},
    })
    expect(clearedTerminal?.tabs[0]?.planeOpenChatAgentId).toBeNull()

    const clearedMissing = sanitizePersistedSession({
      version: 1,
      activeTabId: 't1',
      tabs: [tab('t1', 'p1')],
      cwds: {},
    })
    expect(clearedMissing?.tabs[0]?.planeOpenChatAgentId).toBeNull()
  })

  it('descarta autoImproveContexts legacy de bindings de sesiones viejas sin fallar', () => {
    const result = sanitizePersistedSession({
      version: 1,
      activeTabId: 't1',
      tabs: [{
        id: 't1',
        title: 'Agents',
        paneIds: ['agent'],
        activePaneId: 'agent',
        paneKinds: { agent: 'agent' },
        agentByPane: {
          agent: {
            agentId: 'cursor-bot',
            autoImproveContexts: true,
          },
        } as never,
      }],
      cwds: {},
    })

    expect(result?.tabs[0]?.agentByPane?.agent?.agentId).toBe('cursor-bot')
    expect(result?.tabs[0]?.agentByPane?.agent).not.toHaveProperty('autoImproveContexts')
  })

  it('returns null when no valid tabs', () => {
    expect(sanitizePersistedSession({
      version: 1,
      activeTabId: 'x',
      tabs: [],
      cwds: {},
    })).toBeNull()
  })

  it('keeps slim agent bindings and migrates legacy rich meta to catalog', () => {
    const slim = sanitizePersistedSession({
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
            agentId: 'cursor-bot',
            cliSessionId: ' chat-123 ',
          },
        },
      }],
      cwds: { terminal: '/tmp', agent: '/project' },
    })

    expect(slim?.tabs[0]?.paneKinds).toEqual({ agent: 'agent' })
    expect(slim?.tabs[0]?.agentByPane?.agent).toEqual({
      agentId: 'cursor-bot',
      activeThreadId: 't1',
      threads: [{ id: 't1', title: '', updatedAt: 0, cliSessionId: 'chat-123' }],
    })
    expect(slim?.pendingAgentMigrations).toEqual([])

    const legacy = sanitizePersistedSession({
      version: 1,
      activeTabId: 't1',
      tabs: [{
        id: 't1',
        title: 'Agents',
        paneIds: ['term', 'a1'],
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
        } as never,
      }],
      cwds: { term: '/Users/me/app', a1: '/Users/me/app' },
    })

    // Rich meta legacy: se descarta el pane (no migrar a disco, no inventar binding).
    expect(legacy?.tabs[0]?.paneIds).toEqual(['term'])
    expect(legacy?.tabs[0]?.agentByPane).toBeUndefined()
    expect(legacy?.tabs[0]?.paneKinds).toBeUndefined()
    expect(legacy?.orphanPaneIds).toContain('a1')
    expect(legacy?.pendingAgentMigrations).toEqual([])
  })

  it('drops legacy rich agent panes without inventing placeholders', () => {
    const result = sanitizePersistedSession({
      version: 1,
      activeTabId: 't1',
      tabs: [{
        id: 't1',
        title: 'Agent',
        paneIds: ['agent'],
        activePaneId: 'agent',
        paneKinds: { agent: 'agent' },
        projectFolder: '/tmp/proj',
        agentByPane: {
          agent: {
            provider: 'claude',
            permissionMode: 'readonly' as never,
            name: 'Reader',
          },
        } as never,
      }],
      cwds: {},
    })

    expect(result?.tabs[0]?.paneIds).toEqual([])
    expect(result?.tabs[0]?.agentByPane).toBeUndefined()
    expect(result?.pendingAgentMigrations).toEqual([])
    expect(result?.orphanPaneIds).toContain('agent')
  })

  it('round-trips slim agent bindings across sanitize reload', () => {
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
            agentId: 'deploy-bot',
            cliSessionId: 'sess-1',
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
      agentId: 'deploy-bot',
      activeThreadId: 't1',
      threads: [{ id: 't1', title: '', updatedAt: 0, cliSessionId: 'sess-1' }],
    })
    expect(again?.pendingAgentMigrations).toEqual([])
  })

  it('strips cliSessionId from org workspace tabs but keeps localOnly', () => {
    const result = sanitizePersistedSession({
      version: 1,
      activeTabId: 't1',
      tabs: [{
        id: 't1',
        title: 'Org',
        paneIds: ['agent'],
        activePaneId: 'agent',
        paneKinds: { agent: 'agent' },
        orgWorkspace: { slug: 'acme', workspaceId: 'ws-1' },
        agentByPane: {
          agent: {
            agentId: 'frontend-2',
            cliSessionId: 'sess-org',
            localOnly: true,
          },
        },
      }],
      cwds: {},
    })
    expect(result?.tabs[0]?.agentByPane?.agent).toEqual({
      agentId: 'frontend-2',
      localOnly: true,
      activeThreadId: 't1',
      threads: [{ id: 't1', title: '', updatedAt: 0 }],
    })
    expect(result?.tabs[0]?.agentByPane?.agent).not.toHaveProperty('cliSessionId')
  })

  it('keeps cliSessionId for local workspace tabs', () => {
    const result = sanitizePersistedSession({
      version: 1,
      activeTabId: 't1',
      tabs: [{
        id: 't1',
        title: 'Local',
        paneIds: ['agent'],
        activePaneId: 'agent',
        paneKinds: { agent: 'agent' },
        projectFolder: '/tmp/proj',
        agentByPane: {
          agent: {
            agentId: 'qa',
            cliSessionId: 'sess-local',
          },
        },
      }],
      cwds: {},
    })
    expect(result?.tabs[0]?.agentByPane?.agent).toEqual({
      agentId: 'qa',
      activeThreadId: 't1',
      threads: [{ id: 't1', title: '', updatedAt: 0, cliSessionId: 'sess-local' }],
    })
  })

  it('stripOrgTabAgentCliSessionIds only mutates org-backed tabs', () => {
    const local: TabSession = {
      id: 'local',
      title: 'Local',
      paneIds: ['a'],
      activePaneId: 'a',
      paneKinds: { a: 'agent' },
      agentByPane: { a: { agentId: 'qa', cliSessionId: 'keep' } },
    }
    const org: TabSession = {
      id: 'org',
      title: 'Org',
      paneIds: ['a'],
      activePaneId: 'a',
      paneKinds: { a: 'agent' },
      orgWorkspace: { slug: 'acme', workspaceId: 'ws-1' },
      agentByPane: {
        a: {
          agentId: 'qa',
          localOnly: true,
          activeThreadId: 't1',
          threads: [{ id: 't1', title: 'chat', updatedAt: 10, cliSessionId: 'drop' }],
        },
      },
    }
    expect(stripOrgTabAgentCliSessionIds(local)).toBe(local)
    // Persist/load: quita la sesión del thread; el binding en vivo la conserva
    // para --resume (ver handleAgentMetaChange).
    expect(stripOrgTabAgentCliSessionIds(org).agentByPane?.a).toEqual({
      agentId: 'qa',
      localOnly: true,
      activeThreadId: 't1',
      threads: [{ id: 't1', title: 'chat', updatedAt: 10 }],
    })
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

  it('restores plane loop chains as idle config (not running)', () => {
    const result = sanitizePersistedSession({
      version: 1,
      activeTabId: 't1',
      tabs: [{
        id: 't1',
        title: 'Loops',
        paneIds: ['a1', 'a2'],
        activePaneId: 'a1',
        paneKinds: { a1: 'agent', a2: 'agent' },
        agentByPane: {
          a1: { agentId: 'claude' },
          a2: { agentId: 'cursor' },
        },
        planeLoopChains: [{
          id: 'chain-1',
          steps: [
            { paneId: 'a1', objective: 'scout' },
            { paneId: 'a2', objective: 'fix' },
          ],
          intervalMs: 600_000,
          status: 'waiting',
          cursor: 1,
        }],
      }],
      cwds: {},
    })

    expect(result?.tabs[0]?.planeLoopChains).toEqual([{
      id: 'chain-1',
      steps: [
        { paneId: 'a1', objective: 'scout' },
        { paneId: 'a2', objective: 'fix' },
      ],
      intervalMs: 600_000,
      status: 'idle',
      cursor: 0,
    }])
  })

  it('migrates explorerByPane into explorerByTab', () => {
    const result = sanitizePersistedSession({
      version: 1,
      activeTabId: 't1',
      tabs: [{
        id: 't1',
        title: 'Term',
        paneIds: ['term-1', 'term-2'],
        activePaneId: 'term-2',
        paneKinds: { 'term-1': 'terminal', 'term-2': 'terminal' },
      }],
      cwds: {},
      explorerByPane: {
        'term-1': {
          open: true,
          fullscreen: false,
          selectedRelPath: 'a.ts',
          selectedIsDirectory: false,
          openedRelPath: null,
          expandedRelPaths: [],
          showHiddenDirs: false,
          treeWidthPercent: 30,
          openOnSingleClick: false,
        },
        'term-2': {
          open: false,
          fullscreen: false,
          selectedRelPath: 'b.ts',
          selectedIsDirectory: false,
          openedRelPath: null,
          expandedRelPaths: [],
          showHiddenDirs: false,
          treeWidthPercent: 30,
          openOnSingleClick: false,
        },
      },
    })

    expect(result?.explorerByTab.t1?.open).toBe(true)
    expect(result?.explorerByTab.t1?.selectedRelPath).toBe('b.ts')
    expect(result?.explorerByTab.t1?.fullscreen).toBe(false)
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
