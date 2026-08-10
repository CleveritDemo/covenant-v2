/** Decisión de cuándo avisar al padre de una delegación en AgentPane. */

export type ParentDelegationNotifyDecision = 'notify' | 'hold' | 'none'

/**
 * held: hay delegación padre activa (o retenida).
 * dispatchedNested: este turno emitió fences a especialistas.
 * canDelegate: solo orquestadores pueden retener el hold (workers siempre notifican).
 * aborted: stop / fail — avisar ya si había hold.
 */
export function decideParentDelegationNotify(input: {
  held: boolean
  dispatchedNested: boolean
  canDelegate?: boolean
  aborted?: boolean
}): ParentDelegationNotifyDecision {
  if (!input.held) return 'none'
  if (input.aborted) return 'notify'
  if (input.dispatchedNested && input.canDelegate) return 'hold'
  return 'notify'
}
