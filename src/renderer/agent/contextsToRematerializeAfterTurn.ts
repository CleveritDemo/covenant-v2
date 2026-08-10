import type { TabContext } from '@shared/tabContext'

/**
 * Contextos a rematerializar tras un turno.
 * Org: nunca notes (SSOT = API + contextContents). Nunca agentResult (no pisar Latest/Log).
 */
export function contextsToRematerializeAfterTurn(
  assigned: readonly TabContext[],
  options: { orgWorkspace: boolean },
): TabContext[] {
  return assigned.filter(context => {
    if (context.kind === 'agentResult') return false
    if (options.orgWorkspace && context.kind === 'notes') return false
    return true
  })
}
