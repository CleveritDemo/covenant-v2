export interface AgentChatSaveSchedule {
  schedule(saveFn: () => void, delayMs?: number): void
  flush(): void
  cancel(): void
}

export function createAgentChatSaveSchedule(): AgentChatSaveSchedule {
  let timer: ReturnType<typeof setTimeout> | null = null
  let pending: (() => void) | null = null

  const clearTimer = (): void => {
    if (timer == null) return
    clearTimeout(timer)
    timer = null
  }

  const flush = (): void => {
    clearTimer()
    if (pending == null) return
    const fn = pending
    pending = null
    fn()
  }

  const cancel = (): void => {
    clearTimer()
    pending = null
  }

  const schedule = (saveFn: () => void, delayMs = 500): void => {
    pending = saveFn
    clearTimer()
    timer = setTimeout(flush, delayMs)
  }

  return { schedule, flush, cancel }
}

let defaultSchedule = createAgentChatSaveSchedule()

/** Programa un guardado trailing; reemplaza cualquier pendiente del mismo schedule. */
export function scheduleAgentChatSave(saveFn: () => void, delayMs = 500): void {
  defaultSchedule.schedule(saveFn, delayMs)
}

/** Ejecuta el guardado pendiente de inmediato. */
export function flushAgentChatSave(): void {
  defaultSchedule.flush()
}

/** Descarta el guardado pendiente sin ejecutar. */
export function cancelAgentChatSave(): void {
  defaultSchedule.cancel()
}

/** Aísla el schedule por defecto entre tests. */
export function resetAgentChatSaveScheduleForTests(): void {
  defaultSchedule.cancel()
  defaultSchedule = createAgentChatSaveSchedule()
}
