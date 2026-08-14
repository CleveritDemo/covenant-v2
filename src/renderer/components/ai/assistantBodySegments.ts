/** Segmentos de cuerpo assistant (texto markdown vs fences de código). */
export type AssistantBodySegment =
  | { type: 'text'; content: string }
  | { type: 'code'; lang: string; content: string }

const CONTROL_FENCE_RE =
  /```(?:ia-terminal-results|ia-terminal-changelog|ia-terminal-delegate|ia-terminal-context|ia-terminal-need-sections|ia-terminal-wiki-view|ia-terminal-wiki)[ \t]*\r?\n([\s\S]*?)(?:\r?\n```|$)/g

/** Igual que CONTROL_FENCE_RE pero sin ia-terminal-delegate (visible en streaming). */
const CONTROL_FENCE_EXCEPT_DELEGATE_RE =
  /```(?:ia-terminal-results|ia-terminal-changelog|ia-terminal-context|ia-terminal-need-sections|ia-terminal-wiki-view|ia-terminal-wiki)[ \t]*\r?\n([\s\S]*?)(?:\r?\n```|$)/g

export type StripAgentControlFencesOptions = {
  /** Si true, conserva fences ```ia-terminal-delegate (abiertos o cerrados). */
  keepDelegateFences?: boolean
}

/** Quita fences de control del agente (results/changelog/delegate/context/need-sections). */
export function stripAgentControlFences(
  text: string,
  options?: StripAgentControlFencesOptions,
): string {
  if (!text) return ''
  const re = options?.keepDelegateFences
    ? CONTROL_FENCE_EXCEPT_DELEGATE_RE
    : CONTROL_FENCE_RE
  return text
    .replace(re, '')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+\n/g, '\n')
    .trimEnd()
}

/**
 * Parte el cuerpo en texto / bloques de código por fences ```.
 * Misma lógica que el antiguo `splitAgentBody` de AgentChatBubbles.
 */
/**
 * Índice donde empieza el último segmento (texto o fence) aún en progreso durante streaming.
 * Todo lo anterior es prefijo estable que puede memoizarse entre deltas.
 */
export function findAssistantBodyLiveStart(raw: string): number {
  let segmentStart = 0
  let i = 0
  while (i < raw.length) {
    segmentStart = i
    const fence = raw.indexOf('```', i)
    if (fence === -1) return segmentStart
    if (fence > i) {
      i = fence
      segmentStart = i
    }
    const langEnd = raw.indexOf('\n', i + 3)
    if (langEnd === -1) return segmentStart
    const contentStart = langEnd + 1
    const close = raw.indexOf('\n```', contentStart)
    if (close === -1) return segmentStart
    i = close + 4
  }
  return segmentStart
}

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
