/**
 * Memoria acotada de envíos ya consumidos por un pane.
 *
 * El padre ofrece un `preferSend` en un slot y lo limpia cuando el pane avisa
 * que lo consumió. Entre ambos momentos el effect de intake puede re-ejecutarse
 * (props inline del padre, cambios de `busy`, StrictMode), y sin identidad del
 * envío cada re-entrada encolaba otra copia del mismo mensaje. Con el `sendId`
 * el intake es idempotente: la reoferta se consume sin volver a encolar.
 */

export const MAX_REMEMBERED_SEND_IDS = 64

export function wasSendIdConsumed(
  seen: readonly string[],
  sendId: string | undefined,
): boolean {
  const id = sendId?.trim()
  if (!id) return false
  return seen.includes(id)
}

/** Recuerda `sendId` descartando los más viejos al pasar el tope. */
export function rememberConsumedSendId(
  seen: readonly string[],
  sendId: string | undefined,
  max: number = MAX_REMEMBERED_SEND_IDS,
): string[] {
  const id = sendId?.trim()
  if (!id) return [...seen]
  if (seen.includes(id)) return [...seen]
  const next = [...seen, id]
  if (next.length <= max) return next
  return next.slice(next.length - max)
}

/** Evita liberar planeSendByPane dos veces en reofertas already_consumed. */
export function planAlreadyConsumedPreferSendSlotRelease(
  releasedSendIds: readonly string[],
  sendId: string,
): { shouldReleaseSlot: boolean; nextReleasedSendIds: string[] } {
  if (wasSendIdConsumed(releasedSendIds, sendId)) {
    return { shouldReleaseSlot: false, nextReleasedSendIds: [...releasedSendIds] }
  }
  return {
    shouldReleaseSlot: true,
    nextReleasedSendIds: rememberConsumedSendId(releasedSendIds, sendId),
  }
}
