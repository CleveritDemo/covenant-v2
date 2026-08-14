import type { AgentPreferSend } from './AgentPane'
import { wasSendIdConsumed } from './consumedSendIds'

export interface PreferSendIntakeContext {
  busy: boolean
  preferNewThread: boolean
  canStartHumanTurnNow: boolean
  queuedCount: number
  maxQueued: number
  /** sendIds ya consumidos por este pane: la reoferta no vuelve a encolar. */
  consumedSendIds?: readonly string[]
}

export type PreferSendIntakePlan =
  | { action: 'skip'; reason: 'no_prefer_send' | 'prefer_new_thread' | 'already_handled' }
  | { action: 'consume'; reason: 'already_consumed'; sendId: string }
  | { action: 'ignore'; reason: 'empty_prefer_send'; delegationId?: string; orchestrationJobId?: string }
  | { action: 'reject'; reason: 'queue_full'; delegationId?: string; orchestrationJobId?: string }
  | { action: 'enqueue'; isHumanTurn: boolean }
  | { action: 'dispatch'; isHumanTurn: boolean }

/**
 * Decide qué hacer con un `preferSend` ofrecido por el padre. Es pura para que
 * la re-entrada del effect no cambie el resultado: el mismo envío (`sendId`) se
 * consume una vez y las reofertas se descartan sin duplicar chips en la cola.
 */
export function planPreferSendIntake(
  preferSend: AgentPreferSend | null | undefined,
  handled: AgentPreferSend | null,
  ctx: PreferSendIntakeContext,
): PreferSendIntakePlan {
  if (!preferSend) return { action: 'skip', reason: 'no_prefer_send' }
  if (ctx.preferNewThread) return { action: 'skip', reason: 'prefer_new_thread' }
  if (handled === preferSend) return { action: 'skip', reason: 'already_handled' }

  const sendId = preferSend.sendId?.trim()
  if (sendId && wasSendIdConsumed(ctx.consumedSendIds ?? [], sendId)) {
    return { action: 'consume', reason: 'already_consumed', sendId }
  }

  const prompt = preferSend.text.trim()
  const images = preferSend.images ?? []
  const delegation = preferSend.delegation
  const orchestrationFollowUp = preferSend.orchestrationFollowUp === true
  const isHumanTurn = !orchestrationFollowUp && !delegation
  const delegationId = delegation?.id
  const orchestrationJobId = preferSend.orchestrationJobId?.trim() || undefined

  if (!prompt && images.length === 0) {
    return { action: 'ignore', reason: 'empty_prefer_send', delegationId, orchestrationJobId }
  }

  // Una delegación con carril propio (threadId) no compite con el turno visible:
  // arranca en su hilo aunque el pane esté busy.
  const isLaneDelegation = Boolean(delegation?.threadId?.trim())
  const shouldEnqueue = !isLaneDelegation
    && (ctx.busy || (isHumanTurn && !ctx.canStartHumanTurnNow))
  if (shouldEnqueue) {
    if (ctx.queuedCount >= ctx.maxQueued) {
      return { action: 'reject', reason: 'queue_full', delegationId, orchestrationJobId }
    }
    return { action: 'enqueue', isHumanTurn }
  }
  return { action: 'dispatch', isHumanTurn }
}
