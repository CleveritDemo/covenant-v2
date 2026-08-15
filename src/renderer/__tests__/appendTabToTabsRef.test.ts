import { describe, expect, it } from 'vitest'
import type { TabSession } from '@shared/tabSession'
import {
  appendTabToTabsRef,
  resolveOrgSyncFolders,
  resolveOrgSyncTargetTabs,
} from '../appendTabToTabsRef'

function tab(id: string, projectFolder?: string): TabSession {
  return {
    id,
    title: id,
    paneIds: [],
    activePaneId: '',
    ...(projectFolder ? { projectFolder } : {}),
  }
}

describe('appendTabToTabsRef', () => {
  it('exposes the new org tab to sync before React re-renders', () => {
    const existing = [tab('existing')]
    const newTab = tab('org-new', '/tmp/ws')

    const tabsRef = { current: existing }
    const staleTargets = resolveOrgSyncTargetTabs(tabsRef.current, [newTab.id])
    expect(staleTargets).toHaveLength(0)
    expect(resolveOrgSyncFolders(staleTargets)).toEqual([])

    const nextTabs = appendTabToTabsRef(tabsRef.current, newTab)
    tabsRef.current = nextTabs

    const fixedTargets = resolveOrgSyncTargetTabs(tabsRef.current, [newTab.id])
    expect(fixedTargets).toEqual([newTab])
    expect(resolveOrgSyncFolders(fixedTargets)).toEqual(['/tmp/ws'])
  })
})
