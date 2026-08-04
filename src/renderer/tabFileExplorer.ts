import type { FileExplorerPersistedState } from '@shared/fileExplorerPersistedState'
import {
  DEFAULT_FILE_EXPLORER_STATE,
  normalizeFileExplorerState,
} from '@shared/fileExplorerPersistedState'
import type { TabSession } from '@shared/tabSession'

/** Primer pane terminal usable como raíz del explorador de la tab. */
export function resolveTabTerminalPaneId(tab: TabSession): string | null {
  const terminalIds = tab.paneIds.filter(paneId => tab.paneKinds?.[paneId] !== 'agent')
  if (!terminalIds.length) return null
  if (terminalIds.includes(tab.activePaneId)) return tab.activePaneId
  return terminalIds[0] ?? null
}

/** SessionId sintético del explorador cuando la tab no tiene terminal. */
export function tabExplorerSessionId(tabId: string): string {
  return `tab-explorer:${tabId}`
}

/**
 * SessionId del explorador: preferir un pane terminal existente;
 * si no hay terminal pero sí projectFolder, usar id sintético tab-scoped.
 */
export function resolveTabExplorerSessionId(tab: TabSession): string | null {
  if (!tab.projectFolder?.trim()) return null
  return resolveTabTerminalPaneId(tab) ?? tabExplorerSessionId(tab.id)
}

/**
 * Prefiere `explorerByTab`; si falta, migra desde `explorerByPane`
 * (active terminal → primer terminal → default; open si alguno estaba abierto).
 */
export function migrateExplorerStateByTab(
  tabs: TabSession[],
  explorerByTab?: Record<string, FileExplorerPersistedState>,
  explorerByPane?: Record<string, FileExplorerPersistedState>,
): Record<string, FileExplorerPersistedState> {
  const next: Record<string, FileExplorerPersistedState> = {}
  for (const tab of tabs) {
    const existing = explorerByTab?.[tab.id]
    if (existing) {
      next[tab.id] = normalizeFileExplorerState(existing)
      continue
    }

    const terminalIds = tab.paneIds.filter(paneId => tab.paneKinds?.[paneId] !== 'agent')
    const preferredId = resolveTabTerminalPaneId(tab)
    const fromPane = preferredId && explorerByPane?.[preferredId]
      ? normalizeFileExplorerState(explorerByPane[preferredId])
      : { ...DEFAULT_FILE_EXPLORER_STATE }
    const anyOpen = tab.paneIds.some(paneId => explorerByPane?.[paneId]?.open === true)
      || terminalIds.some(paneId => explorerByPane?.[paneId]?.open === true)
    next[tab.id] = {
      ...fromPane,
      open: anyOpen || fromPane.open,
    }
  }
  return next
}
