/** Segmentos de cuerpo assistant (texto markdown vs fences de código). */
export type AssistantBodySegment =
  | { type: 'text'; content: string }
  | { type: 'code'; lang: string; content: string }

const CONTROL_FENCE_RE =
  /```(?:ia-terminal-results|ia-terminal-changelog|ia-terminal-delegate|ia-terminal-context|ia-terminal-need-sections)[ \t]*\r?\n([\s\S]*?)(?:\r?\n```|$)/g

/** Quita fences de control del agente (results/changelog/delegate/context/need-sections). */
export function stripAgentControlFences(text: string): string {
  if (!text) return ''
  return text
    .replace(CONTROL_FENCE_RE, '')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+\n/g, '\n')
    .trimEnd()
}

/**
 * Parte el cuerpo en texto / bloques de código por fences ```.
 * Misma lógica que el antiguo `splitAgentBody` de AgentChatBubbles.
 */
export function splitAssistantBody(raw: string): AssistantBodySegment[] {
  const segments: AssistantBodySegment[] = []
  const pushText = (chunk: string): void => {
    if (chunk.trim()) segments.push({ type: 'text', content: chunk.replace(/\s+$/, '') })
  }
  let i = 0
  while (i < raw.length) {
    const fence = raw.indexOf('```', i)
    if (fence === -1) {
      pushText(raw.slice(i))
      break
    }
    if (fence > i) pushText(raw.slice(i, fence))
    const langEnd = raw.indexOf('\n', fence + 3)
    if (langEnd === -1) {
      segments.push({ type: 'code', lang: raw.slice(fence + 3).trim(), content: '' })
      break
    }
    const lang = raw.slice(fence + 3, langEnd).trim()
    const contentStart = langEnd + 1
    const close = raw.indexOf('\n```', contentStart)
    if (close === -1) {
      segments.push({ type: 'code', lang, content: raw.slice(contentStart) })
      break
    }
    segments.push({ type: 'code', lang, content: raw.slice(contentStart, close).replace(/\s+$/, '') })
    i = close + 4
  }
  return segments
}
