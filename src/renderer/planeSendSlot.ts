/**
 * Buzón `preferSend`: un envío por pane, ofrecido a `AgentPane` hasta que lo
 * consume.
 *
 * Las dos operaciones viven acá porque las dos se hacían mal contra el estado
 * de React y el resultado era un interbloqueo:
 *
 * - **Tomar el hueco** se decidía con un booleano puesto DENTRO del updater de
 *   `setState` y leído justo después. El updater no corre síncrono, así que el
 *   drenaje creía que no había podido colocar el envío, lo devolvía a la FIFO
 *   —y el updater lo colocaba igual—. Quedaban dos copias del mismo envío: una
 *   en el buzón y otra en la cola.
 * - **Soltar el hueco** borraba lo que hubiera en el buzón, sin mirar si era el
 *   envío que se estaba consumiendo. Para protegerse de eso, el pane soltaba
 *   una sola vez por `sendId`; con la copia duplicada la segunda oferta ya no
 *   soltaba nada y el buzón quedaba tomado para siempre. Con el buzón tomado la
 *   FIFO de orquestación no drena, `systemFollowUpsPending` no baja y la cola
 *   humana del pane no vuelve a arrancar: los mensajes se quedan encolados sin
 *   que nada esté corriendo.
 *
 * Ambas son puras y se aplican sobre un ref síncrono; el estado es solo el
 * espejo para pintar.
 */

export interface PlaneSendSlotItem {
  sendId?: string
}

export function claimPlaneSendSlot<T extends PlaneSendSlotItem>(
  slots: Readonly<Record<string, T>>,
  paneId: string,
  item: T,
): { slots: Record<string, T>; claimed: boolean } {
  if (slots[paneId]) return { slots: slots as Record<string, T>, claimed: false }
  return { slots: { ...slots, [paneId]: item }, claimed: true }
}

/**
 * Vacía el buzón solo si sigue teniendo el envío que se consumió. Sin `sendId`
 * (o con un buzón sin él) se vacía igual: es el consumo del envío actual.
 */
export function releasePlaneSendSlot<T extends PlaneSendSlotItem>(
  slots: Readonly<Record<string, T>>,
  paneId: string,
  sendId?: string,
): Record<string, T> {
  const current = slots[paneId]
  if (!current) return slots as Record<string, T>
  const asked = sendId?.trim()
  const held = current.sendId?.trim()
  if (asked && held && asked !== held) return slots as Record<string, T>
  const next = { ...slots }
  delete next[paneId]
  return next
}
