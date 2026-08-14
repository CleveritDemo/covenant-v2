import type { AgentChatEntry } from '@shared/agentCliTypes'

export interface QueuedTurnPlaneImage {
  previewUrl: string
}

export interface QueuedTurnPlaneItem {
  id: string
  text: string
  images: QueuedTurnPlaneImage[]
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
