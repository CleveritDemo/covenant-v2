/** Ancho del modal wiki (`TerminalModal` size sm). */
export const WIKI_MODAL_WIDTH = 400

/** Alto estimado del modal wiki (titlebar + cuerpo compacto). */
export const WIKI_MODAL_ESTIMATED_HEIGHT = 280

const DEFAULT_PADDING = 8

export interface WikiModalSpreadInput {
  count: number
  width: number
  height: number
  modalWidth: number
  modalHeight: number
  padding?: number
}

function clampAxis(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

/**
 * Posiciones dispersas para varios modales wiki dentro de un rect.
 * Espiral desde el centro: ángulos equidistantes, radio adaptativo al bounds.
 */
export function computeWikiModalSpreadPositions({
  count,
  width,
  height,
  modalWidth,
  modalHeight,
  padding = DEFAULT_PADDING,
}: WikiModalSpreadInput): Array<{ x: number; y: number }> {
  if (count <= 0) return []

  const minX = padding
  const minY = padding
  const maxX = Math.max(minX, width - modalWidth - padding)
  const maxY = Math.max(minY, height - modalHeight - padding)
  const centerX = clampAxis((width - modalWidth) / 2, minX, maxX)
  const centerY = clampAxis((height - modalHeight) / 2, minY, maxY)

  if (count === 1) {
    return [{ x: Math.round(centerX), y: Math.round(centerY) }]
  }

  const radiusX = Math.min(centerX - minX, maxX - centerX)
  const radiusY = Math.min(centerY - minY, maxY - centerY)
  const radius = Math.max(
    32,
    Math.min(radiusX, radiusY, width * 0.18, height * 0.14),
  )

  const positions: Array<{ x: number; y: number }> = []
  for (let index = 0; index < count; index += 1) {
    const angle = (2 * Math.PI * index) / count - Math.PI / 2
    const rawX = centerX + radius * Math.cos(angle)
    const rawY = centerY + radius * Math.sin(angle)
    positions.push({
      x: Math.round(clampAxis(rawX, minX, maxX)),
      y: Math.round(clampAxis(rawY, minY, maxY)),
    })
  }

  return positions
}
