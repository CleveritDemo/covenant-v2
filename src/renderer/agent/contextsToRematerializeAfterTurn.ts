import type { TabContext } from '@shared/tabContext'

/**
 * Contextos a rematerializar tras un turno.
 * Nunca agentResult (no pisar Latest/Log). Notes y el resto van a disco local-first.
 */
export function contextsToRematerializeAfterTurn(
  assigned: readonly TabContext[],
  _options?: { orgWorkspace?: boolean },
): TabContext[] {
  return assigned.filter(context => context.kind !== 'agentResult')
}
