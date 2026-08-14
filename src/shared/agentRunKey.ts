import { DEFAULT_THREAD_ID } from './agentThreads'

export const RUN_KEY_SEP = '::'

/** Clave de ejecución: un carril CLI por hilo dentro de un pane. */
export function buildRunKey(paneId: string, threadId?: string): string {
  const pane = String(paneId ?? '').trim()
  const thread = String(threadId ?? '').trim() || DEFAULT_THREAD_ID
  return `${pane}${RUN_KEY_SEP}${thread}`
}

/** Parte por el primer separador; sin `::` el id entero es paneId. */
export function parseRunKey(key: string): { paneId: string; threadId: string } {
  const raw = String(key ?? '')
  const sep = raw.indexOf(RUN_KEY_SEP)
  if (sep < 0) {
    return { paneId: raw, threadId: DEFAULT_THREAD_ID }
  }
  return {
    paneId: raw.slice(0, sep),
    threadId: raw.slice(sep + RUN_KEY_SEP.length) || DEFAULT_THREAD_ID,
  }
}

export function isRunKeyForPane(key: string, paneId: string): boolean {
  return parseRunKey(key).paneId === paneId
}
