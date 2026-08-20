import type { OrchestratorPath } from './onboarding'

export type OnboardingGuideAnchor =
  | 'path-picker'
  | 'project-folder'
  | 'create-team'
  | 'brainstorm-rail'
  | 'brainstorm-start'
  | 'brainstorm-ceremony'
  | 'brainstorm-stop'
  | 'brainstorm-finish'
  | 'composer-agents'
  | 'composer-input'
  | 'brainstorm-goal'
  | 'brainstorm-participants'
  | 'brainstorm-module-tabs'
  | 'brainstorm-rooms-list'
  | 'brainstorm-human-composer'
  | 'context-pool'
  | 'context-new'
  | 'context-kind'
  | 'context-name'
  | 'context-save'
  | 'plane-terminal-fab'

/**
 * Pasos que se cierran con OK. Son los informativos: cuentan algo y no hay una
 * acción que el resolver pueda observar. Un paso de acción NUNCA entra aquí, o
 * el OK se lo saltaría (ver onboardingGuideDismissible.test.ts).
 */
export const DISMISSIBLE_GUIDE_STEPS: readonly OnboardingGuideStepId[] = [
  'write_goal',
  'join_round',
  'stop_room',
  'finish_room',
  'saved_rooms',
  'open_terminal',
]

export function isDismissibleGuideStep(step: string): boolean {
  return (DISMISSIBLE_GUIDE_STEPS as readonly string[]).includes(step)
}

export type OnboardingGuideStepId =
  | 'choose_path'
  | 'pick_folder'
  | 'create_team'
  | 'open_brainstorm'
  | 'start_ceremony'
  | 'pick_ceremony'
  | 'select_agent'
  | 'send_message'
  | 'write_goal'
  | 'pick_participants'
  | 'join_round'
  | 'stop_room'
  | 'finish_room'
  | 'saved_rooms'
  | 'new_context'
  | 'pick_context_kind'
  | 'name_context'
  | 'create_context'
  | 'assign_context'
  | 'open_terminal'

export type OnboardingGuideStep = {
  step: OnboardingGuideStepId
  anchor: OnboardingGuideAnchor
  messageKey: string
  /** true: el coach mark avanza con el botón OK. */
  dismissible?: boolean
  /** true: el OK existe pero está deshabilitado (falta hacer la acción). */
  dismissDisabled?: boolean
}

export type OnboardingGuideResolveArgs = {
  path: OrchestratorPath | ''
  projectFolder?: string
  hasFolder?: boolean
  hasAgents: boolean
  openChatAgentId: string | null
  brainstormOverlayOpen: boolean
  brainstormView?: 'rooms' | 'setup' | string | null
  incomplete?: boolean
  brainstormGoalFilled?: boolean
  brainstormParticipantCount?: number
  /** Usuario abrió o eligió el formato/ceremonia en el setup. */
  brainstormCeremonyPicked?: boolean
  brainstormRoomLive?: boolean
  /** La sala en vista sigue viva: el botón Detener está montado. */
  brainstormRoomStoppable?: boolean
  /** La sala en vista ya no corre: el botón Terminar está montado. */
  brainstormRoomFinishable?: boolean
  humanSpokeInRoom?: boolean
  sentFirstMessage?: boolean
  /** Modal de contextos abierto en este tab (listado o formulario). */
  contextsModalOpen?: boolean
  /** El usuario eligió el tipo de contexto a mano (no el que trae por defecto). */
  contextKindPicked?: boolean
  /** El nombre del contexto tiene texto. */
  contextNameFilled?: boolean
  assignedAnyContext?: boolean
  /** Ya hay un pane terminal en el tab: open_terminal se salta solo. */
  terminalOpen?: boolean
  doneSteps?: readonly string[]
}

function guideStep(
  step: OnboardingGuideStepId,
  anchor: OnboardingGuideAnchor,
  messageCamel: string,
  dismissDisabled?: boolean,
): OnboardingGuideStep {
  return {
    step,
    anchor,
    messageKey: `tabs.onboardingGuide.${messageCamel}`,
    ...(isDismissibleGuideStep(step) ? { dismissible: true } : {}),
    ...(dismissDisabled ? { dismissDisabled: true } : {}),
  }
}

/**
 * Clave del título del paso: la misma del mensaje con sufijo `Title`. El paso
 * pinta título (la acción) + descripción (para qué sirve), así que las dos
 * claves viven juntas en i18n y no hay que declararlas dos veces por paso.
 */
export function onboardingGuideTitleKey(step: OnboardingGuideStep): string {
  return `${step.messageKey}Title`
}

export function resolveOnboardingGuideStep(
  args: OnboardingGuideResolveArgs,
): OnboardingGuideStep | null {
  if (args.incomplete === false) return null

  const hasFolder = args.hasFolder ?? Boolean((args.projectFolder ?? '').trim())
  const doneSteps = args.doneSteps ?? []
  const participantCount = args.brainstormParticipantCount ?? 0

  if (args.path === '') {
    return guideStep('choose_path', 'path-picker', 'choosePath')
  }
  if (!hasFolder) {
    return guideStep('pick_folder', 'project-folder', 'pickFolder')
  }
  if (!args.hasAgents) {
    return guideStep('create_team', 'create-team', 'createTeam')
  }

  if (args.path === 'business') {
    const viewUnsetAndRoomIdle = args.brainstormView == null && !args.brainstormRoomLive
    const joinRoundDone = doneSteps.includes('join_round')
    const joinedOrSpoke = args.humanSpokeInRoom || joinRoundDone
    // Tras join_round (OK) o hablar, cerrar el módulo no reabre «Open Brainstorm».
    if (!args.brainstormOverlayOpen || viewUnsetAndRoomIdle) {
      if (joinedOrSpoke) return null
      return guideStep('open_brainstorm', 'brainstorm-rail', 'openBrainstorm')
    }
    // Biblioteca de salas: aquí no hay setup que enseñar. Si ya participó, el
    // paso es dónde quedó el acta; si no, abrir la sala viva o crear una nueva.
    if (args.brainstormView === 'rooms') {
      if (joinedOrSpoke) {
        // Ya recorrió una sala: solo queda enseñar la biblioteca. Después la
        // escalera se agota aquí; si no, «crea una sala» volvería para siempre.
        if (!doneSteps.includes('saved_rooms')) {
          return guideStep('saved_rooms', 'brainstorm-module-tabs', 'savedRooms')
        }
        return null
      }
      if (args.brainstormRoomLive) {
        return guideStep('open_brainstorm', 'brainstorm-rooms-list', 'openLiveRoom')
      }
      return guideStep('open_brainstorm', 'brainstorm-module-tabs', 'newRoom')
    }
    // El objetivo se confirma con OK, no tecleando: el OK está deshabilitado
    // mientras el campo esté vacío, así que nadie salta el paso sin escribir.
    // Todo el alta es solo para quien aún no participó en una sala.
    const goalDone = doneSteps.includes('write_goal')
    const inSetup = args.brainstormView === 'setup' && !joinedOrSpoke
    if (inSetup && !goalDone) {
      return guideStep(
        'write_goal',
        'brainstorm-goal',
        'writeGoal',
        !args.brainstormGoalFilled,
      )
    }
    if (inSetup && goalDone && participantCount < 2) {
      return guideStep('pick_participants', 'brainstorm-participants', 'pickParticipants')
    }
    if (inSetup && goalDone && participantCount >= 2 && !args.brainstormCeremonyPicked) {
      return guideStep('pick_ceremony', 'brainstorm-ceremony', 'pickCeremony')
    }
    if (inSetup && goalDone && participantCount >= 2 && args.brainstormCeremonyPicked) {
      return guideStep('start_ceremony', 'brainstorm-start', 'startCeremony')
    }
    // Informativo: puede enviar, no obligatorio. Avanza con OK (dismissible).
    // A quien ya habló no se le cuenta: el tip ya no le enseña nada.
    if (args.brainstormRoomLive && !joinedOrSpoke) {
      return guideStep('join_round', 'brainstorm-human-composer', 'joinRound')
    }
    // Antes de cerrar hay que parar: Detener vive en el chrome de la sala y solo
    // existe mientras la sala está viva.
    if (
      joinedOrSpoke
      && args.brainstormRoomStoppable
      && !doneSteps.includes('stop_room')
    ) {
      return guideStep('stop_room', 'brainstorm-stop', 'stopRoom')
    }
    // Sala terminada: Terminar la suelta del plano y su acta queda en la
    // biblioteca, que es el paso siguiente (saved_rooms).
    if (
      joinedOrSpoke
      && args.brainstormRoomFinishable
      && !doneSteps.includes('finish_room')
    ) {
      return guideStep('finish_room', 'brainstorm-finish', 'finishRoom')
    }
    // saved_rooms solo donde existen las pestañas del módulo (no en sala viva).
    if (
      joinedOrSpoke
      && !doneSteps.includes('saved_rooms')
      && args.brainstormView === 'setup'
    ) {
      return guideStep('saved_rooms', 'brainstorm-module-tabs', 'savedRooms')
    }
    return null
  }

  if (args.path === 'engineer') {
    if (!args.openChatAgentId) {
      return guideStep('select_agent', 'composer-agents', 'selectAgent')
    }
    // Sin OK: espera el envío real.
    if (!args.sentFirstMessage) {
      return guideStep('send_message', 'composer-input', 'sendMessage')
    }
    // Dentro del modal el alta se enseña en tres pasos: tipo → nombre → guardar.
    // Ninguno tiene OK; cada uno muere al hacerse. Van antes que new_context
    // porque con el modal abierto el «+» queda detrás.
    if (args.contextsModalOpen) {
      if (!args.contextKindPicked) {
        return guideStep('pick_context_kind', 'context-kind', 'pickContextKind')
      }
      if (!args.contextNameFilled) {
        return guideStep('name_context', 'context-name', 'nameContext')
      }
      return guideStep('create_context', 'context-save', 'createContext')
    }
    // Sin OK: espera el «+». App marca new_context al abrirlo, así que al volver
    // del modal el paso ya no reaparece.
    if (!doneSteps.includes('new_context')) {
      return guideStep('new_context', 'context-new', 'newContext')
    }
    // Sin OK y sin escape por doneSteps: espera el arrastre real del contexto.
    if (!args.assignedAnyContext) {
      return guideStep('assign_context', 'context-pool', 'assignContext')
    }
    // Con una terminal ya abierta el paso no tiene nada que enseñar.
    if (!args.terminalOpen && !doneSteps.includes('open_terminal')) {
      return guideStep('open_terminal', 'plane-terminal-fab', 'openTerminal')
    }
    return null
  }

  return null
}
