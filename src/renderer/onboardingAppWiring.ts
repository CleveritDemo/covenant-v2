import {
  canCompleteOnboarding,
} from '@shared/onboardingFlow'
import type { OrchestratorPath } from '@shared/onboarding'
import {
  resolveOnboardingGuideStep,
  type OnboardingGuideResolveArgs,
} from '@shared/onboardingGuideFlow'

export type OnboardingGuideTabSnapshot = {
  incomplete: boolean
  path: OrchestratorPath | ''
  projectFolder?: string | null
  paneKinds?: Record<string, unknown>
  planeOpenChatAgentId?: string | null
  brainstormView?: string | null
  brainstormDraft?: { goalFilled: boolean; participantCount: number }
  brainstormRooms?: readonly { id: string }[]
  liveRoomIds?: ReadonlySet<string> | readonly string[]
  humanSpokeByRoom?: Record<string, boolean>
  sentFirstMessage: boolean
  assignedAnyContext: boolean
  doneSteps: readonly string[]
}

function asLiveIdSet(
  liveRoomIds: OnboardingGuideTabSnapshot['liveRoomIds'],
): ReadonlySet<string> {
  if (!liveRoomIds) return new Set()
  return liveRoomIds instanceof Set ? liveRoomIds : new Set(liveRoomIds)
}

/** Mapea el snapshot del tab a los args del resolver de la escalera. */
export function buildGuideResolveArgs(
  tab: OnboardingGuideTabSnapshot,
): OnboardingGuideResolveArgs {
  const rooms = tab.brainstormRooms ?? []
  const liveIds = asLiveIdSet(tab.liveRoomIds)
  return {
    incomplete: tab.incomplete,
    path: tab.path,
    hasFolder: Boolean((tab.projectFolder ?? '').trim()),
    hasAgents: Object.values(tab.paneKinds ?? {}).some(kind => kind === 'agent'),
    openChatAgentId: tab.planeOpenChatAgentId ?? null,
    brainstormOverlayOpen: Boolean(tab.brainstormView),
    brainstormView: tab.brainstormView ?? null,
    brainstormGoalFilled: tab.brainstormDraft?.goalFilled,
    brainstormParticipantCount: tab.brainstormDraft?.participantCount,
    brainstormRoomLive: rooms.some(room => liveIds.has(room.id)),
    humanSpokeInRoom: rooms.some(room => Boolean(tab.humanSpokeByRoom?.[room.id])),
    sentFirstMessage: tab.sentFirstMessage,
    assignedAnyContext: tab.assignedAnyContext,
    doneSteps: tab.doneSteps,
  }
}

/** Cierra el onboarding solo si la escalera se agotó y el trigger lo permite. */
export function shouldCompleteByGuideExhausted(args: {
  resolveArgs: OnboardingGuideResolveArgs
  cliAllMissing: boolean
}): boolean {
  if (resolveOnboardingGuideStep(args.resolveArgs) !== null) return false
  return canCompleteOnboarding({
    incomplete: args.resolveArgs.incomplete !== false,
    path: args.resolveArgs.path,
    trigger: 'guide_exhausted',
    cliAllMissing: args.cliAllMissing,
  })
}
