/** Hold de delegación padre por pane (sobrevive remount de AgentPane). */

export interface ActiveParentDelegation {
  id: string
  fromPaneId: string
  toAgentId: string
}

const byPane = new Map<string, ActiveParentDelegation>()

export function rememberActiveParentDelegation(
  paneId: string,
  delegation: ActiveParentDelegation,
): void {
  const id = paneId.trim()
  if (!id || !delegation.id.trim()) return
  byPane.set(id, {
    id: delegation.id.trim(),
    fromPaneId: delegation.fromPaneId.trim(),
    toAgentId: delegation.toAgentId.trim(),
  })
}

export function peekActiveParentDelegation(paneId: string): ActiveParentDelegation | null {
  return byPane.get(paneId.trim()) ?? null
}

export function clearActiveParentDelegation(paneId: string): void {
  byPane.delete(paneId.trim())
}

/** Test helper: vacía el registry. */
export function resetActiveParentDelegationsForTests(): void {
  byPane.clear()
}
