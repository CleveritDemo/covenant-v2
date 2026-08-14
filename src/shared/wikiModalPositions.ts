/** Ancho del modal wiki (`TerminalModal` size sm). */
export const WIKI_MODAL_WIDTH = 400

/** Alto estimado del modal wiki (titlebar + cuerpo compacto). */
export const WIKI_MODAL_ESTIMATED_HEIGHT = 280

const DEFAULT_PADDING = 8

/** Zona muerta inferior-centro: curador + chat del plano (~45% ancho, ~38% alto). */
const DEAD_ZONE_WIDTH_RATIO = 0.45
const DEAD_ZONE_HEIGHT_RATIO = 0.38

export interface WikiModalSpreadInput {
  count: number
  width: number
  height: number
  modalWidth: number
  modalHeight: number
  padding?: number
}

export interface WikiModalDeadZone {
  left: number
  top: number
  right: number
  bottom: number
}

function clampAxis(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

/** Rect de exclusión para curador + chat en la franja inferior del mapa. */
export function computeWikiModalDeadZone(width: number, height: number): WikiModalDeadZone {
  const zoneWidth = width * DEAD_ZONE_WIDTH_RATIO
  const zoneHeight = height * DEAD_ZONE_HEIGHT_RATIO
  const left = (width - zoneWidth) / 2
  const top = height - zoneHeight
  return { left, top, right: left + zoneWidth, bottom: height }
}

/** True si el modal (esquina superior izquierda) solapa la zona muerta. */
export function modalOverlapsWikiDeadZone(
  x: number,
  y: number,
  modalWidth: number,
  modalHeight: number,
  width: number,
  height: number,
): boolean {
  const zone = computeWikiModalDeadZone(width, height)
  const right = x + modalWidth
  const bottom = y + modalHeight
  return x < zone.right && right > zone.left && y < zone.bottom && bottom > zone.top
}

type SlotFraction = { fx: number; fy: number }

/** Slots perimetrales (fx/fy ∈ [0,1] dentro del rect disponible). */
function perimeterSlotFractions(count: number): SlotFraction[] {
  if (count <= 0) return []
  if (count === 1) return [{ fx: 0, fy: 0 }]
  if (count === 2) return [{ fx: 0, fy: 0 }, { fx: 1, fy: 0 }]
  if (count === 3) return [{ fx: 0, fy: 0 }, { fx: 1, fy: 0 }, { fx: 0.5, fy: 1 }]

  const anchors: SlotFraction[] = [
    { fx: 0, fy: 0 },
    { fx: 0.5, fy: 0 },
    { fx: 1, fy: 0 },
    { fx: 1, fy: 0.35 },
    { fx: 0, fy: 0.35 },
    { fx: 0.25, fy: 0 },
    { fx: 0.75, fy: 0 },
    { fx: 0, fy: 0.2 },
    { fx: 1, fy: 0.2 },
  ]
  return anchors.slice(0, count)
}

function slotToPosition(
  slot: SlotFraction,
  minX: number,
  minY: number,
  maxX: number,
  maxY: number,
): { x: number; y: number } {
  return {
    x: Math.round(minX + slot.fx * (maxX - minX)),
    y: Math.round(minY + slot.fy * (maxY - minY)),
  }
}

/**
 * Posiciones perimetrales para varios modales wiki dentro de un rect.
 * Evita la zona muerta inferior-centro (curador + chat).
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
  const deadZone = computeWikiModalDeadZone(width, height)
  const maxY = Math.max(
    minY,
    Math.min(
      height - modalHeight - padding,
      deadZone.top - modalHeight - padding,
    ),
  )

  const fractions = perimeterSlotFractions(count)
  const positions: Array<{ x: number; y: number }> = []

  for (const slot of fractions) {
    const pos = slotToPosition(slot, minX, minY, maxX, maxY)
    positions.push({
      x: clampAxis(pos.x, minX, maxX),
      y: clampAxis(pos.y, minY, maxY),
    })
  }

  return positions
}
