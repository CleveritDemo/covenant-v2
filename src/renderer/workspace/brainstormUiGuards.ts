import {
  createBrainstormRoom,
  type BrainstormRoom,
  type BrainstormRoomBrief,
} from '@shared/brainstormRoom'

/** Paso invitados: hace falta al menos 2 agentes. */
export function canAdvanceBrainstormInviteStep(
  participantAgentIds: readonly string[],
): boolean {
  return participantAgentIds.filter(id => id.trim()).length >= 2
}

/**
 * Valida tema + invitados vía createBrainstormRoom (misma regla que al iniciar).
 * Devuelve la sala o null si no se puede arrancar.
 */
export function tryCreateBrainstormSession(
  topic: string,
  participantAgentIds: readonly string[],
  maxRounds?: number,
  brief?: BrainstormRoomBrief,
): BrainstormRoom | null {
  return createBrainstormRoom(topic, [...participantAgentIds], maxRounds, brief)
}
