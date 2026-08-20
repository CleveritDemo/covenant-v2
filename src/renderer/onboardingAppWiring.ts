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
  brainstormDraft?: {
    goalFilled: boolean
    participantCount: number
    ceremonyPicked?: boolean
  }
  brainstormRooms?: readonly { id: string }[]
  liveRoomIds?: ReadonlySet<string> | readonly string[]
  humanSpokeByRoom?: Record<string, boolean>
  /** Modal de contextos abierto en este tab. */
  contextsModalOpen?: boolean
  /** Progreso del alta dentro del modal (tipo elegido, nombre puesto). */
  contextKindPicked?: boolean
  contextNameFilled?: boolean
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
  // brainstormView con un id de sala = sala en vista. Viva → botón Detener
  // (showStop); parada → botón Terminar (canFinish de BrainstormRoomView).
  const view = tab.brainstormView ?? null
  const viewedRoomId = view && view !== 'rooms' && view !== 'setup' ? view : null
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
    brainstormCeremonyPicked: tab.brainstormDraft?.ceremonyPicked === true,
    brainstormRoomLive: rooms.some(room => liveIds.has(room.id)),
    brainstormRoomStoppable: Boolean(
      viewedRoomId
      && rooms.some(room => room.id === viewedRoomId)
      && liveIds.has(viewedRoomId),
    ),
    brainstormRoomFinishable: Boolean(
      viewedRoomId
      && rooms.some(room => room.id === viewedRoomId)
      && !liveIds.has(viewedRoomId),
    ),
    // Persiste aunque onFinish quite la sala del tab: si no, al cerrar el
    // módulo la escalera vuelve a open_brainstorm.
    humanSpokeInRoom: Object.values(tab.humanSpokeByRoom ?? {}).some(Boolean),
    contextsModalOpen: tab.contextsModalOpen === true,
    contextKindPicked: tab.contextKindPicked === true,
    contextNameFilled: tab.contextNameFilled === true,
    sentFirstMessage: tab.sentFirstMessage,
    assignedAnyContext: tab.assignedAnyContext,
    doneSteps: tab.doneSteps,
  }
}

/**
 * Planear con el módulo a la vista: el null es transitorio (sala en vista o sala
 * viva) y saved_rooms todavía tiene que enseñar dónde queda el acta. Sin esto,
 * un OK en finish_room dentro de la sala cerraría el onboarding antes.
 */
function holdsUntilSavedRooms(resolveArgs: OnboardingGuideResolveArgs): boolean {
  if (resolveArgs.path !== 'business') return false
  if ((resolveArgs.doneSteps ?? []).includes('saved_rooms')) return false
  return resolveArgs.brainstormView != null || Boolean(resolveArgs.brainstormRoomLive)
}

/** Cierra el onboarding solo si la escalera se agotó y el trigger lo permite. */
export function shouldCompleteByGuideExhausted(args: {
  resolveArgs: OnboardingGuideResolveArgs
  cliAllMissing: boolean
}): boolean {
  if (resolveOnboardingGuideStep(args.resolveArgs) !== null) return false
  if (holdsUntilSavedRooms(args.resolveArgs)) return false
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
  clisProbed: boolean
}

/** Se abre una sola vez por pestaña, venga del CTA o de cualquier otra vía. */
export function shouldAutoOpenCeremonyOverlay(args: CeremonyAutoOpenArgs): boolean {
  if (!args.clisProbed) return false
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
