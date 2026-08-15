/** Máximo un warn queue_full por sendId mientras persista el rechazo. */
export function shouldLogPreferSendQueueFull(
  sendId: string | undefined,
  loggedSendIds: Set<string>,
): boolean {
  const id = sendId?.trim()
  if (!id) return true
  if (loggedSendIds.has(id)) return false
  loggedSendIds.add(id)
  return true
}
