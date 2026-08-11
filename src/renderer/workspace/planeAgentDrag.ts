/**
 * MIME del drag de agentes del plano hacia la mesa de brainstorm.
 * Espejo de `planeContextDrag`: el payload es el id de catálogo del agente.
 */
export const PLANE_AGENT_DRAG_MIME = 'application/x-gravity-plane-agent'

export function setPlaneAgentDragData(dataTransfer: DataTransfer, agentId: string): void {
  dataTransfer.setData(PLANE_AGENT_DRAG_MIME, agentId)
  // Sin `text/plain` a propósito: soltar la card en un textarea no debe pegar el id.
  dataTransfer.effectAllowed = 'copy'
}

export function hasPlaneAgentDrag(dataTransfer: DataTransfer | null): boolean {
  if (!dataTransfer) return false
  return Array.from(dataTransfer.types).includes(PLANE_AGENT_DRAG_MIME)
}

export function readPlaneAgentDragData(dataTransfer: DataTransfer): string | null {
  const id = dataTransfer.getData(PLANE_AGENT_DRAG_MIME).trim()
  return id || null
}
