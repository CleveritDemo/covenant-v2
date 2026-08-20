import {
  canCompleteOnboarding,
  onboardingLockedSurface,
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
    terminalOpen: Object.values(tab.paneKinds ?? {}).some(kind => kind === 'terminal'),
    doneSteps: tab.doneSteps,
  }
}

/** Cierra el onboarding solo si la escalera se agotó y el trigger lo permite. */
export function shouldCompleteByGuideExhausted(args: {
  resolveArgs: OnboardingGuideResolveArgs
  cliAllMissing: boolean
}): boolean {
  if (resolveOnboardingGuideStep(args.resolveArgs) !== null) return false
  // El null dentro del módulo (sala terminada, o sala viva tras hablar) es transitorio y no significa escalera agotada;
  // matar la guía ahí deja al usuario sin ningún coach mark al reabrir brainstorm y saved_rooms inalcanzable.
  const a = args.resolveArgs
  const savedRoomsDone = (a.doneSteps ?? []).includes('saved_rooms')
  if (a.path === 'business' && !savedRoomsDone && (a.brainstormView != null || a.brainstormRoomLive === true)) return false
  return canCompleteOnboarding({
    incomplete: args.resolveArgs.incomplete !== false,
    path: args.resolveArgs.path,
    trigger: 'guide_exhausted',
    cliAllMissing: args.cliAllMissing,
  })
}

export type CeremonyAutoOpenArgs = {
  incomplete: boolean
  path: OrchestratorPath | ''
  hasFolder: boolean
  hasAgents: boolean
  cliAllMissing: boolean
  brainstormView?: string | null
  brainstormRoomLive?: boolean
  alreadyAutoOpened: boolean
}

/** Se abre una sola vez por pestaña, venga del CTA o de cualquier otra vía. */
export function shouldAutoOpenCeremonyOverlay(args: CeremonyAutoOpenArgs): boolean {
  if (args.alreadyAutoOpened) return false
  if (args.brainstormView != null) return false
  if (args.brainstormRoomLive === true) return false
  return onboardingLockedSurface({
    incomplete: args.incomplete,
    path: args.path,
    hasFolder: args.hasFolder,
    hasAgents: args.hasAgents,
    cliAllMissing: args.cliAllMissing,
  }).autoOpenCeremonyOverlay
}

export type ComposerEngineTabSnapshot = {
  planeOpenChatAgentId?: string | null
  paneKinds?: Record<string, unknown>
}

/**
 * True si el pane con chat abierto es un agente sin motor primario: su turno
 * aborta en AgentPane (agentPane.missingProvider) y el envío nunca sale.
 * resolveProvider recibe el paneId y devuelve meta.provider (o undefined).
 */
export function composerEngineMissingForTab(
  tab: ComposerEngineTabSnapshot,
  resolveProvider: (paneId: string) => string | undefined,
): boolean {
  const paneId = tab.planeOpenChatAgentId ?? null
  if (!paneId) return false
  if (tab.paneKinds?.[paneId] !== 'agent') return false
  return !(resolveProvider(paneId) ?? '').trim()
}
