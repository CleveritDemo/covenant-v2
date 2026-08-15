import { afterEach, describe, expect, it, vi } from 'vitest'
import { existsSync, mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

const userDataRoot = mkdtempSync(join(tmpdir(), 'agent-chat-persist-'))

vi.mock('electron', () => ({
  app: { getPath: () => userDataRoot },
}))

const {
  loadAgentChat,
  saveAgentChat,
  deleteAgentChat,
  sweepOrphanAgentChats,
} = await import('../persistence')
const {
  agentChatRefFor,
  planAgentChatCleanupForRemovedPanes,
  resolveAgentChatStorageKey,
  shouldDeleteAgentChatOnCatalogCleanup,
} = await import('../../src/shared/agentChatPersistence')
const { syncTabAgentsFromCatalog } = await import('../../src/renderer/projectAgentsStore')
import { DEFAULT_THREAD_ID } from '../../src/shared/agentThreads'
import type { TabSession } from '../../src/shared/tabSession'
import type { AgentChatEntry } from '../../src/shared/agentCliTypes'

afterEach(() => {
  const dir = join(userDataRoot, 'agent-chats')
  if (existsSync(dir)) rmSync(dir, { recursive: true, force: true })
})

function entry(id: string, content: string): AgentChatEntry {
  return { id, role: 'user', content }
}

function baseTab(partial: Partial<TabSession> = {}): TabSession {
  return {
    id: 't1',
    title: 'T',
    paneIds: [],
    activePaneId: '',
    ...partial,
  }
}

describe('resolveAgentChatStorageKey', () => {
  it('misma agentId+org ⇒ misma clave aunque cambie paneId o carpeta local', () => {
    const scope = {
      projectFolder: '/old/path',
      orgWorkspace: { slug: 'acme', workspaceId: 'ws-1' },
    }
    const a = resolveAgentChatStorageKey(scope, 'qa', 'pane-old')
    const b = resolveAgentChatStorageKey(
      { ...scope, projectFolder: '/new/clone' },
      'qa',
      'pane-new',
    )
    expect(a).toBe(b)
    expect(a).not.toBe('pane-old')
  })

  it('workspace local aísla por projectFolder', () => {
    const a = resolveAgentChatStorageKey({ projectFolder: '/proj-a' }, 'qa')
    const b = resolveAgentChatStorageKey({ projectFolder: '/proj-b' }, 'qa')
    expect(a).not.toBe(b)
  })
})

describe('load/save/deleteAgentChat', () => {
  it('migra legacy paneId.json a la clave estable y carga con paneId nuevo', () => {
    const scope = {
      projectFolder: '/repo',
      orgWorkspace: { slug: 'acme', workspaceId: 'ws-1' },
    }
    const legacyPaneId = 'pane-legacy'
    const messages = [entry('m1', 'hola')]
    mkdirSync(join(userDataRoot, 'agent-chats'), { recursive: true })
    writeFileSync(
      join(userDataRoot, 'agent-chats', `${legacyPaneId}.json`),
      JSON.stringify(messages),
      'utf-8',
    )

    const oldRef = agentChatRefFor(scope, 'qa', legacyPaneId)
    expect(loadAgentChat(oldRef, DEFAULT_THREAD_ID)).toEqual(messages)
    expect(existsSync(join(userDataRoot, 'agent-chats', `${legacyPaneId}.json`))).toBe(false)
    expect(existsSync(join(userDataRoot, 'agent-chats', oldRef.storageKey, `${DEFAULT_THREAD_ID}.json`))).toBe(true)

    const newRef = agentChatRefFor(scope, 'qa', 'pane-after-sync')
    expect(newRef.storageKey).toBe(oldRef.storageKey)
    expect(loadAgentChat(newRef, DEFAULT_THREAD_ID)).toEqual(messages)
  })

  it('clear conversation (delete) aísla el historial; un pane nuevo arranca vacío', () => {
    const scope = { projectFolder: '/repo' }
    const ref = agentChatRefFor(scope, 'frontend', 'pane-1')
    saveAgentChat(ref, DEFAULT_THREAD_ID, [entry('m1', 'keep?')])
    deleteAgentChat(ref)
    expect(loadAgentChat(agentChatRefFor(scope, 'frontend', 'pane-2'), DEFAULT_THREAD_ID)).toEqual([])
  })
})

describe('planAgentChatCleanupForRemovedPanes + syncTabAgentsFromCatalog', () => {
  it('(a) mismo agentId con paneId nuevo: cleanup preserve + load recupera mensajes', () => {
    const scope = {
      projectFolder: '/org-ws',
      orgWorkspace: { slug: 'acme', workspaceId: 'ws-1' },
    }
    const oldPane = 'pane-old'
    const messages = [entry('m1', 'previo al sync')]
    saveAgentChat(agentChatRefFor(scope, 'qa', oldPane), DEFAULT_THREAD_ID, messages)

    let n = 0
    // Forzar pane nuevo: el binding previo no está en el tab (p. ej. sesión regenerada).
    const synced = syncTabAgentsFromCatalog(
      baseTab({
        projectFolder: '/org-ws',
        orgWorkspace: { slug: 'acme', workspaceId: 'ws-1' },
        paneIds: [],
        activePaneId: '',
      }),
      [{ id: 'qa', provider: 'cursor', permissionMode: 'auto', name: 'qa' }],
      {
        createPaneId: () => `new-${++n}`,
        createWindow: () => ({ open: false, fullscreen: false, zIndex: 1 }),
        preserveCliSessionIds: false,
      },
    )
    expect(synced.addedPaneIds).toEqual(['new-1'])
    expect(synced.tab.agentByPane?.['new-1']?.agentId).toBe('qa')

    const actions = planAgentChatCleanupForRemovedPanes(
      [{ paneId: oldPane, agentId: 'qa' }],
      new Set(['qa']),
      scope,
    )
    expect(actions).toEqual([
      { type: 'preserve', ref: agentChatRefFor(scope, 'qa', oldPane) },
    ])
    // Simulate cleanup preserve: migrate/load
    void loadAgentChat(actions[0]!.ref, DEFAULT_THREAD_ID)
    expect(loadAgentChat(agentChatRefFor(scope, 'qa', 'new-1'), DEFAULT_THREAD_ID)).toEqual(messages)
  })

  it('(b) wipeLocal false + sync: agentId en catálogo ⇒ no delete del chat', () => {
    const scope = {
      projectFolder: '/org-ws',
      orgWorkspace: { slug: 'acme', workspaceId: 'ws-1' },
    }
    expect(shouldDeleteAgentChatOnCatalogCleanup('qa', new Set(['qa', 'frontend']))).toBe(false)

    const actions = planAgentChatCleanupForRemovedPanes(
      [
        { paneId: 'dup-pane', agentId: 'qa' },
        { paneId: 'gone-pane', agentId: 'retired' },
      ],
      new Set(['qa', 'frontend']),
      scope,
    )
    expect(actions.map(a => a.type)).toEqual(['preserve', 'delete'])

    saveAgentChat(agentChatRefFor(scope, 'qa', 'dup-pane'), DEFAULT_THREAD_ID, [entry('m1', 'keep')])
    saveAgentChat(agentChatRefFor(scope, 'retired', 'gone-pane'), DEFAULT_THREAD_ID, [entry('m2', 'drop')])
    for (const action of actions) {
      if (action.type === 'preserve') loadAgentChat(action.ref, DEFAULT_THREAD_ID)
      else deleteAgentChat(action.ref)
    }
    expect(loadAgentChat(agentChatRefFor(scope, 'qa', 'pane-fresh'), DEFAULT_THREAD_ID)).toEqual([
      entry('m1', 'keep'),
    ])
    expect(loadAgentChat(agentChatRefFor(scope, 'retired', 'x'), DEFAULT_THREAD_ID)).toEqual([])
  })

  it('(c) agente fuera del catálogo ⇒ delete; close/clear usa delete del ref estable', () => {
    const scope = { projectFolder: '/repo' }
    expect(shouldDeleteAgentChatOnCatalogCleanup('gone', new Set(['qa']))).toBe(true)
    expect(shouldDeleteAgentChatOnCatalogCleanup(undefined, new Set(['qa']))).toBe(true)

    const ref = agentChatRefFor(scope, 'qa', 'pane-close')
    saveAgentChat(ref, DEFAULT_THREAD_ID, [entry('m1', 'bye')])
    deleteAgentChat(ref)
    const raw = join(userDataRoot, 'agent-chats', ref.storageKey)
    expect(existsSync(raw)).toBe(false)
  })

  it('preserveCliSessionIds false no implica borrar transcript (solo afecta cliSessionId)', () => {
    let n = 0
    const result = syncTabAgentsFromCatalog(
      baseTab({
        projectFolder: '/org-ws',
        orgWorkspace: { slug: 'acme', workspaceId: 'ws-1' },
        paneIds: ['a-qa'],
        activePaneId: 'a-qa',
        paneKinds: { 'a-qa': 'agent' },
        agentByPane: { 'a-qa': { agentId: 'qa', cliSessionId: 'sess-1' } },
      }),
      [{ id: 'qa', provider: 'cursor', permissionMode: 'auto' }],
      {
        createPaneId: () => `new-${++n}`,
        createWindow: () => ({ open: false, fullscreen: false, zIndex: 1 }),
        preserveCliSessionIds: false,
      },
    )
    expect(result.removedPaneIds).toEqual([])
    expect(result.tab.agentByPane?.['a-qa']).toEqual({ agentId: 'qa' })
    expect(result.changed).toBe(true)
  })
})

describe('sweepOrphanAgentChats', () => {
  it('borra los transcripts de hilos que ya no están en el catálogo', () => {
    const scope = { projectFolder: '/tmp/proj' }
    const ref = agentChatRefFor(scope, 'frontend', 'pane-1')
    saveAgentChat(ref, 'keep-1', [entry('m1', 'vive')])
    saveAgentChat(ref, 'orphan-1', [entry('m2', 'podado')])
    saveAgentChat(ref, DEFAULT_THREAD_ID, [entry('m3', 'legacy')])

    const session = {
      version: 1 as const,
      activeTabId: 'tab-1',
      cwds: {},
      tabs: [baseTab({
        id: 'tab-1',
        projectFolder: '/tmp/proj',
        paneIds: ['pane-1'],
        paneKinds: { 'pane-1': 'agent' },
        agentByPane: {
          'pane-1': {
            agentId: 'frontend',
            activeThreadId: 'keep-1',
            threads: [{ id: 'keep-1', title: '', updatedAt: 1 }],
          },
        },
      })],
    }

    const result = sweepOrphanAgentChats(session)
    expect(result.deleted).toBe(1)
    expect(result.bytes).toBeGreaterThan(0)
    expect(loadAgentChat(ref, 'keep-1')).toHaveLength(1)
    expect(loadAgentChat(ref, 'orphan-1')).toHaveLength(0)
    // El hilo por defecto se conserva: puede materializarse por adopción.
    expect(loadAgentChat(ref, DEFAULT_THREAD_ID)).toHaveLength(1)
  })

  it('une los hilos de dos panes que comparten carpeta de agente', () => {
    const scope = { projectFolder: '/tmp/proj' }
    const ref = agentChatRefFor(scope, 'frontend', 'pane-1')
    saveAgentChat(ref, 'de-pane-1', [entry('m1', 'a')])
    saveAgentChat(ref, 'de-pane-2', [entry('m2', 'b')])

    const session = {
      version: 1 as const,
      activeTabId: 'tab-1',
      cwds: {},
      tabs: [baseTab({
        id: 'tab-1',
        projectFolder: '/tmp/proj',
        paneIds: ['pane-1', 'pane-2'],
        paneKinds: { 'pane-1': 'agent', 'pane-2': 'agent' },
        agentByPane: {
          'pane-1': {
            agentId: 'frontend',
            activeThreadId: 'de-pane-1',
            threads: [{ id: 'de-pane-1', title: '', updatedAt: 1 }],
          },
          'pane-2': {
            agentId: 'frontend',
            activeThreadId: 'de-pane-2',
            threads: [{ id: 'de-pane-2', title: '', updatedAt: 2 }],
          },
        },
      })],
    }

    expect(sweepOrphanAgentChats(session).deleted).toBe(0)
    expect(loadAgentChat(ref, 'de-pane-1')).toHaveLength(1)
    expect(loadAgentChat(ref, 'de-pane-2')).toHaveLength(1)
  })
})
