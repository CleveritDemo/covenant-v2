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
} = await import('../persistence')
const {
  agentChatRefFor,
  planAgentChatCleanupForRemovedPanes,
  resolveAgentChatStorageKey,
  shouldDeleteAgentChatOnCatalogCleanup,
} = await import('../../src/shared/agentChatPersistence')
const { syncTabAgentsFromCatalog } = await import('../../src/renderer/projectAgentsStore')
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
    expect(loadAgentChat(oldRef)).toEqual(messages)
    expect(existsSync(join(userDataRoot, 'agent-chats', `${legacyPaneId}.json`))).toBe(false)
    expect(existsSync(join(userDataRoot, 'agent-chats', `${oldRef.storageKey}.json`))).toBe(true)

    const newRef = agentChatRefFor(scope, 'qa', 'pane-after-sync')
    expect(newRef.storageKey).toBe(oldRef.storageKey)
    expect(loadAgentChat(newRef)).toEqual(messages)
  })

  it('clear conversation (delete) aísla el historial; un pane nuevo arranca vacío', () => {
    const scope = { projectFolder: '/repo' }
    const ref = agentChatRefFor(scope, 'frontend', 'pane-1')
    saveAgentChat(ref, [entry('m1', 'keep?')])
    deleteAgentChat(ref)
    expect(loadAgentChat(agentChatRefFor(scope, 'frontend', 'pane-2'))).toEqual([])
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
    saveAgentChat(agentChatRefFor(scope, 'qa', oldPane), messages)

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
        maxPanes: 10,
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
    void loadAgentChat(actions[0]!.ref)
    expect(loadAgentChat(agentChatRefFor(scope, 'qa', 'new-1'))).toEqual(messages)
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

    saveAgentChat(agentChatRefFor(scope, 'qa', 'dup-pane'), [entry('m1', 'keep')])
    saveAgentChat(agentChatRefFor(scope, 'retired', 'gone-pane'), [entry('m2', 'drop')])
    for (const action of actions) {
      if (action.type === 'preserve') loadAgentChat(action.ref)
      else deleteAgentChat(action.ref)
    }
    expect(loadAgentChat(agentChatRefFor(scope, 'qa', 'pane-fresh'))).toEqual([
      entry('m1', 'keep'),
    ])
    expect(loadAgentChat(agentChatRefFor(scope, 'retired', 'x'))).toEqual([])
  })

  it('(c) agente fuera del catálogo ⇒ delete; close/clear usa delete del ref estable', () => {
    const scope = { projectFolder: '/repo' }
    expect(shouldDeleteAgentChatOnCatalogCleanup('gone', new Set(['qa']))).toBe(true)
    expect(shouldDeleteAgentChatOnCatalogCleanup(undefined, new Set(['qa']))).toBe(true)

    const ref = agentChatRefFor(scope, 'qa', 'pane-close')
    saveAgentChat(ref, [entry('m1', 'bye')])
    deleteAgentChat(ref)
    const raw = join(userDataRoot, 'agent-chats', `${ref.storageKey}.json`)
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
        maxPanes: 10,
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
