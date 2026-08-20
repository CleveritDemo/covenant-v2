/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from 'vitest'
import type { TabSession } from '../../shared/tabSession'
import { orgAccountIdForCwd, orgAccountIdForTab, orgCatalogForTab } from '../App'

const tab = (overrides: Partial<TabSession> = {}): TabSession => ({
  id: 't1',
  title: 'Tab',
  paneIds: [],
  activePaneId: '',
  ...overrides,
})

describe('orgAccountIdForTab', () => {
  it('prefiere accountId persistido en orgWorkspace', () => {
    const resolve = () => 'from-folder'
    expect(orgAccountIdForTab(tab({
      orgWorkspace: { slug: 'o', workspaceId: 'w', accountId: 'acc-2' },
    }), resolve)).toBe('acc-2')
  })

  it('resuelve por carpeta si no hay accountId persistido', () => {
    const resolve = (cwd: string | undefined | null) => (cwd === '/proj' ? 'acc-1' : '')
    expect(orgAccountIdForTab(tab({
      projectFolder: '/proj',
      orgWorkspace: { slug: 'o', workspaceId: 'w', localDir: '/other' },
    }), resolve)).toBe('acc-1')
  })
})

describe('orgAccountIdForCwd', () => {
  const resolve = (cwd: string | undefined | null) => (cwd === '/proj' ? 'acc-folder' : 'acc-fallback')

  it('encuentra la pestaña por localDir', () => {
    const tabs = [tab({
      projectFolder: '/other',
      orgWorkspace: { slug: 'o', workspaceId: 'w', localDir: '/proj', accountId: 'acc-tab' },
    })]
    expect(orgAccountIdForCwd(tabs, '/proj', resolve)).toBe('acc-tab')
  })

  it('encuentra la pestaña por projectFolder', () => {
    const tabs = [tab({ projectFolder: '/proj' })]
    expect(orgAccountIdForCwd(tabs, '/proj', resolve)).toBe('acc-folder')
  })

  it('prefiere orgWorkspace.accountId sobre la resolución por carpeta', () => {
    const tabs = [tab({
      projectFolder: '/proj',
      orgWorkspace: { slug: 'o', workspaceId: 'w', localDir: '/proj', accountId: 'acc-persisted' },
    })]
    expect(orgAccountIdForCwd(tabs, '/proj', resolve)).toBe('acc-persisted')
  })

  it('cae al fallback cuando ninguna pestaña coincide', () => {
    const tabs = [tab({ projectFolder: '/other' })]
    expect(orgAccountIdForCwd(tabs, '/proj', resolve)).toBe('acc-folder')
  })

  it('dos pestañas org de cuentas distintas devuelven cada una su accountId', () => {
    const resolveByFolder = (cwd: string | undefined | null) => {
      if (cwd === '/ws-a') return 'acc-a-folder'
      if (cwd === '/ws-b') return 'acc-b-folder'
      return ''
    }
    const tabs = [
      tab({
        id: 't-a',
        projectFolder: '/ws-a',
        orgWorkspace: { slug: 'o1', workspaceId: 'w1', localDir: '/ws-a', accountId: 'acc-a' },
      }),
      tab({
        id: 't-b',
        projectFolder: '/ws-b',
        orgWorkspace: { slug: 'o2', workspaceId: 'w2', localDir: '/ws-b', accountId: 'acc-b' },
      }),
    ]
    expect(orgAccountIdForCwd(tabs, '/ws-a', resolveByFolder)).toBe('acc-a')
    expect(orgAccountIdForCwd(tabs, '/ws-b', resolveByFolder)).toBe('acc-b')
  })
})

describe('orgCatalogForTab', () => {
  const map = {
    byAccount: {
      'acc-1': { login: 'a', fetchedAt: 1, entries: [{ slug: 'o', orgName: 'O', workspaceId: 'w', name: 'W' }] },
      'acc-2': { login: 'b', fetchedAt: 1, entries: [] },
    },
  }

  it('elige el catálogo de la cuenta de la pestaña', () => {
    const resolve = () => 'fallback'
    expect(orgCatalogForTab(map, tab({
      orgWorkspace: { slug: 'o', workspaceId: 'w', accountId: 'acc-2' },
    }), resolve)?.login).toBe('b')
    expect(orgCatalogForTab(map, tab({
      projectFolder: '/x',
      orgWorkspace: { slug: 'o', workspaceId: 'w' },
    }), () => 'acc-1')?.entries[0]?.name).toBe('W')
  })
})
