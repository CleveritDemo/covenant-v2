import type { AgentChatEntry } from '@shared/agentCliTypes'

/** Mensajes publicados al plano: vacío en tab inactivo para evitar re-renders del transcript. */
export function resolvePlaneStatusMessages(
  tabActive: boolean,
  messages: readonly AgentChatEntry[],
): AgentChatEntry[] {
  if (!tabActive) return []
  return messages.filter(entry => entry.role === 'user' || entry.role === 'assistant')
}
