import type { AgentPreferSend } from './AgentPane'

export interface PreferSendIntakeContext {
  busy: boolean
  loopActive: boolean
  preferNewThread: boolean
  canStartHumanTurnNow: boolean
  queuedCount: number
  maxQueued: number
}

export type PreferSendIntakePlan =
  | { action: 'skip'; reason: 'no_prefer_send' | 'prefer_new_thread' | 'loop_active' | 'already_handled' }
  | { action: 'ignore'; reason: 'empty_prefer_send'; delegationId?: string; orchestrationJobId?: string }
  | { action: 'reject'; reason: 'queue_full'; delegationId?: string; orchestrationJobId?: string }
  | { action: 'enqueue'; isHumanTurn: boolean }
  | { action: 'dispatch'; isHumanTurn: boolean }

export function planPreferSendIntake(
  preferSend: AgentPreferSend | null | undefined,
  handled: AgentPreferSend | null,
  ctx: PreferSendIntakeContext,
): PreferSendIntakePlan {
  if (!preferSend) return { action: 'skip', reason: 'no_prefer_send' }
  if (ctx.preferNewThread) return { action: 'skip', reason: 'prefer_new_thread' }
  if (handled === preferSend) return { action: 'skip', reason: 'already_handled' }
  if (ctx.loopActive) return { action: 'skip', reason: 'loop_active' }

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

  const shouldEnqueue = ctx.busy || (isHumanTurn && !ctx.canStartHumanTurnNow)
  if (shouldEnqueue) {
    if (ctx.queuedCount >= ctx.maxQueued) {
      return { action: 'reject', reason: 'queue_full', delegationId, orchestrationJobId }
    }
    return { action: 'enqueue', isHumanTurn }
  }
  return { action: 'dispatch', isHumanTurn }
}
