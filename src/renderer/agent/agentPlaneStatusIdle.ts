import type { AgentChatEntry } from '@shared/agentCliTypes'

export interface QueuedTurnPlaneImage {
  previewUrl: string
}

export interface QueuedTurnPlaneItem {
  id: string
  text: string
  images: QueuedTurnPlaneImage[]
}

/** Igualdad de hilos activos publicados al plano (longitud + ids en orden). */
export function runningThreadIdsPlaneStatusEqual(
  previous: readonly string[] | undefined,
  next: readonly string[],
): boolean {
  return (previous?.length ?? 0) === next.length
    && (previous ?? []).every((id, i) => id === next[i])
}

/** Campos de gating por hilo: activeThreadId + runningThreadIds. */
export function planeThreadGatingFieldsEqual(
  previous: { activeThreadId?: string; runningThreadIds?: readonly string[] } | undefined,
  next: { activeThreadId?: string; runningThreadIds: readonly string[] },
): boolean {
  return (previous?.activeThreadId ?? '') === (next.activeThreadId ?? '')
    && runningThreadIdsPlaneStatusEqual(previous?.runningThreadIds, next.runningThreadIds)
}

/** Igualdad de cola publicada al plano (incluye previewUrl para thumbs async). */
export function queuedTurnsPlaneStatusEqual(
  previous: QueuedTurnPlaneItem[] | undefined,
  next: QueuedTurnPlaneItem[],
): boolean {
  return (previous?.length ?? 0) === next.length
    && (previous ?? []).every((item, i) => {
      const other = next[i]
      if (!other) return false
      if (item.id !== other.id || item.text !== other.text) return false
      if (item.images.length !== other.images.length) return false
      return item.images.every((image, j) =>
        image.previewUrl === other.images[j]?.previewUrl,
      )
    })
}

/** Mensajes publicados al plano: vacío en tab inactivo para evitar re-renders del transcript. */
export function resolvePlaneStatusMessages(
  tabActive: boolean,
  messages: readonly AgentChatEntry[],
): AgentChatEntry[] {
  if (!tabActive) return []
  return messages.filter(entry => entry.role === 'user' || entry.role === 'assistant')
}

/** Último prompt del usuario, recortado a 120, para el snippet de la mini-card. */
export function planeStatusUserSnippet(
  messages: readonly AgentChatEntry[],
): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    const entry = messages[i]
    if (!entry || entry.role !== 'user') continue
    const text = entry.content.trim()
    if (!text) continue
    return text.length > 120 ? `${text.slice(0, 117)}…` : text
  }
  return ''
}

/**
 * Igualdad de las actividades por hilo publicadas al plano. Sustituye a un par
 * de `JSON.stringify` por publicación: serializar para comparar asignaba en el
 * camino caliente del streaming.
 */
export function runningThreadActivitiesEqual(
  previous: Readonly<Record<string, string>> | undefined,
  next: Readonly<Record<string, string>> | undefined,
): boolean {
  const a = previous ?? {}
  const b = next ?? {}
  const keysA = Object.keys(a)
  if (keysA.length !== Object.keys(b).length) return false
  return keysA.every(key => Object.prototype.hasOwnProperty.call(b, key) && a[key] === b[key])
}
