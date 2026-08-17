import {
  AGENT_CLI_PROVIDER_IDS,
  type AgentCliProvider,
  type AgentCliResolution,
} from '@shared/agentCliProviders'

/**
 * Ids que un desplegable de CLI puede ofrecer. Mapa vacío = todavía
 * resolviendo: no afirmar que falta nada. Con entradas, solo los que
 * tienen `path`; el seleccionado nunca desaparece (si no está instalado
 * va al final).
 */
export function pickableProviderIds(
  statuses: Partial<Record<AgentCliProvider, AgentCliResolution>>,
  selected: AgentCliProvider,
): AgentCliProvider[] {
  if (Object.keys(statuses).length === 0) return [...AGENT_CLI_PROVIDER_IDS]
  const ids = AGENT_CLI_PROVIDER_IDS.filter(id => statuses[id]?.path != null)
  if (!ids.includes(selected)) ids.push(selected)
  return ids
}
