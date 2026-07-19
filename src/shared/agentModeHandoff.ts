import type { AgentChatEntry } from './agentCliTypes'

/** Tope de historial inyectado tras reiniciar la sesión CLI por cambio de modo. */
export const MODE_HANDOFF_MAX_CHARS = 24_000

function roleLabel(role: AgentChatEntry['role']): string {
  if (role === 'user') return 'User'
  if (role === 'assistant') return 'Assistant'
  return 'System'
}

/**
 * Construye el prompt del primer turno tras abandonar una sesión CLI:
 * reinyecta el historial local del chat para que el agente no pierda el
 * plan/contexto al cambiar de modo (p. ej. Plan → Auto).
 */
export function buildModeHandoffPrompt(
  priorMessages: AgentChatEntry[],
  nextUserPrompt: string,
  maxChars = MODE_HANDOFF_MAX_CHARS,
): string {
  const usable = priorMessages.filter(message => message.content.trim().length > 0)
  const blocks: string[] = []
  let used = 0

  for (let i = usable.length - 1; i >= 0; i -= 1) {
    const message = usable[i]!
    const block = `### ${roleLabel(message.role)}\n${message.content.trim()}`
    const cost = block.length + (blocks.length ? 2 : 0)
    if (used + cost > maxChars) break
    blocks.unshift(block)
    used += cost
  }

  const history = blocks.length
    ? blocks.join('\n\n')
    : '(No prior messages were available to restore.)'

  return [
    '## Prior conversation',
    'The CLI session was restarted after a permission mode change.',
    'Continue from this history; do not ask the user to repeat it.',
    '',
    history,
    '',
    '## Current user request',
    nextUserPrompt.trim(),
  ].join('\n')
}
