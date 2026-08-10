import {
  createBrainstormRoom,
  sanitizeBrainstormInviteIds,
  type BrainstormRoom,
  type BrainstormRoomBrief,
} from '@shared/brainstormRoom'
import type { ProjectAgentDefinition } from '@shared/projectAgentCatalog'

export type BrainstormInviteCatalog = readonly Pick<
  ProjectAgentDefinition,
  'id' | 'localOnly'
>[]

/** Paso invitados: hace falta al menos 2 agentes (sin réplicas si hay catálogo). */
export function canAdvanceBrainstormInviteStep(
  participantAgentIds: readonly string[],
  agents?: BrainstormInviteCatalog,
): boolean {
  const ids = agents
    ? sanitizeBrainstormInviteIds(participantAgentIds, agents)
    : participantAgentIds.filter(id => id.trim())
  return ids.length >= 2
}

/**
 * Valida tema + invitados vía createBrainstormRoom (misma regla que al iniciar).
 * Con catálogo, excluye réplicas (`localOnly`) antes de crear.
 * Devuelve la sala o null si no se puede arrancar.
 */
export function tryCreateBrainstormSession(
  topic: string,
  participantAgentIds: readonly string[],
  maxRounds?: number,
  agents?: BrainstormInviteCatalog,
  brief?: BrainstormRoomBrief,
): BrainstormRoom | null {
  const ids = agents
    ? sanitizeBrainstormInviteIds(participantAgentIds, agents)
    : [...participantAgentIds]
  return createBrainstormRoom(topic, ids, maxRounds, brief)
}
