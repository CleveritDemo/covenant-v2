/** Ventana fija para acumular deltas de streaming antes de un setMessages. */
export const ASSISTANT_DELTA_THROTTLE_MS = 200

export function createAssistantDeltaThrottler(
  applyBatch: (assistantId: string, text: string) => void,
  throttleMs: number = ASSISTANT_DELTA_THROTTLE_MS,
): {
  append: (assistantId: string, text: string) => void
  flush: () => void
  dispose: () => void
} {
  let timer: number | null = null
  let pendingAssistantId: string | null = null
  let pendingText = ''

  const clearTimer = (): void => {
    if (timer == null) return
    clearTimeout(timer)
    timer = null
  }

  const flush = (): void => {
    clearTimer()
    if (!pendingAssistantId || !pendingText) return
    const assistantId = pendingAssistantId
    const text = pendingText
    pendingAssistantId = null
    pendingText = ''
    applyBatch(assistantId, text)
  }

  const append = (assistantId: string, text: string): void => {
    if (!text) return
    if (pendingAssistantId && pendingAssistantId !== assistantId) {
      flush()
    }
    pendingAssistantId = assistantId
    pendingText += text
    if (timer != null) return
    timer = setTimeout(() => {
      timer = null
      flush()
    }, throttleMs) as unknown as number
  }

  const dispose = (): void => {
    flush()
  }

  return { append, flush, dispose }
}
