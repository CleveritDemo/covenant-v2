/** MIME del drag de contextos del pool hacia agentes del plano. */
export const PLANE_CONTEXT_DRAG_MIME = 'application/x-iaterminal-tab-context'

export function setPlaneContextDragData(dataTransfer: DataTransfer, contextId: string): void {
  dataTransfer.setData(PLANE_CONTEXT_DRAG_MIME, contextId)
  dataTransfer.setData('text/plain', contextId)
  dataTransfer.effectAllowed = 'copy'
}

export function hasPlaneContextDrag(dataTransfer: DataTransfer): boolean {
  return Array.from(dataTransfer.types).includes(PLANE_CONTEXT_DRAG_MIME)
}

export function readPlaneContextDragData(dataTransfer: DataTransfer): string | null {
  const id = (dataTransfer.getData(PLANE_CONTEXT_DRAG_MIME) || dataTransfer.getData('text/plain')).trim()
  return id || null
}
