import type { TabSession } from '@shared/tabSession'

/** Append a tab and return the next array (assign to tabsRef before setTabs). */
export function appendTabToTabsRef(current: TabSession[], tab: TabSession): TabSession[] {
  return [...current, tab]
}

/** Target tabs for syncOrgWorkspaceContent — must read tabsRef after append. */
export function resolveOrgSyncTargetTabs(tabs: TabSession[], tabIds: string[]): TabSession[] {
  return tabs.filter(item => tabIds.includes(item.id))
}

/** Project folders resolved for org workspace content sync. */
export function resolveOrgSyncFolders(targets: TabSession[]): string[] {
  return [...new Set(
    targets
      .map(tab => tab.projectFolder?.trim() || tab.orgWorkspace?.localDir?.trim() || '')
      .filter(Boolean),
  )]
}
