/** Ancho del modal wiki (`TerminalModal` size sm). */
export const WIKI_MODAL_WIDTH = 400

/** Alto estimado del modal wiki (titlebar + cuerpo compacto). */
export const WIKI_MODAL_ESTIMATED_HEIGHT = 280

const DEFAULT_PADDING = 8

const MAX_PLACEMENT_ATTEMPTS = 24

/** Zona muerta inferior-centro: curador + chat del plano (~45% ancho, ~38% alto). */
const DEAD_ZONE_WIDTH_RATIO = 0.45
const DEAD_ZONE_HEIGHT_RATIO = 0.38

export interface WikiModalNearPointInput {
  originX: number
  originY: number
  width: number
  height: number
  modalWidth: number
  modalHeight: number
  padding?: number
}

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

function modalCenter(x: number, y: number, modalWidth: number, modalHeight: number): { cx: number; cy: number } {
  return { cx: x + modalWidth / 2, cy: y + modalHeight / 2 }
}

function centerDistance(
  a: { x: number; y: number },
  b: { x: number; y: number },
  modalWidth: number,
  modalHeight: number,
): number {
  const ac = modalCenter(a.x, a.y, modalWidth, modalHeight)
  const bc = modalCenter(b.x, b.y, modalWidth, modalHeight)
  return Math.hypot(ac.cx - bc.cx, ac.cy - bc.cy)
}

function isTooCloseToExisting(
  candidate: { x: number; y: number },
  accepted: Array<{ x: number; y: number }>,
  modalWidth: number,
  modalHeight: number,
): boolean {
  const minDist = Math.min(180, modalWidth * 0.45)
  return accepted.some(pos => centerDistance(candidate, pos, modalWidth, modalHeight) < minDist)
}

export function wikiModalDockSide(originX: number, width: number): 'left' | 'right' {
  return originX < width / 2 ? 'left' : 'right'
}

/** Docks to the same screen edge as the node half (left half → left edge, right half → right edge); vertically centers on origin; avoids curator dead zone. */
export function computeWikiModalPositionNearPoint({
  originX,
  originY,
  width,
  height,
  modalWidth,
  modalHeight,
  padding = DEFAULT_PADDING,
}: WikiModalNearPointInput): { x: number; y: number } {
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

  const side = wikiModalDockSide(originX, width)
  let x = side === 'right' ? width - modalWidth - padding : padding

  let y = Math.round(originY - modalHeight / 2)
  y = clampAxis(y, minY, maxY)

  if (modalOverlapsWikiDeadZone(x, y, modalWidth, modalHeight, width, height)) {
    y = Math.min(y, deadZone.top - modalHeight - padding)
    y = clampAxis(y, minY, maxY)
  }

  x = clampAxis(x, minX, maxX)

  return { x, y }
}

/**
 * Posiciones aleatorias para varios modales wiki dentro de un rect.
 * Evita la zona muerta inferior-centro (curador + chat).
 */
export function computeWikiModalSpreadPositions(
  {
    count,
    width,
    height,
    modalWidth,
    modalHeight,
    padding = DEFAULT_PADDING,
  }: WikiModalSpreadInput,
  random: () => number = Math.random,
): Array<{ x: number; y: number }> {
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

  const positions: Array<{ x: number; y: number }> = []

  for (let i = 0; i < count; i += 1) {
    let candidate = { x: minX, y: minY }
    let accepted = false

    for (let attempt = 0; attempt < MAX_PLACEMENT_ATTEMPTS; attempt += 1) {
      const spanX = maxX - minX
      const spanY = maxY - minY
      const x = Math.round(minX + random() * spanX)
      const y = Math.round(minY + random() * spanY)
      candidate = {
        x: clampAxis(x, minX, maxX),
        y: clampAxis(y, minY, maxY),
      }

      if (
        modalOverlapsWikiDeadZone(candidate.x, candidate.y, modalWidth, modalHeight, width, height)
        || isTooCloseToExisting(candidate, positions, modalWidth, modalHeight)
      ) {
        continue
      }

      accepted = true
      break
    }

    if (!accepted) {
      candidate = {
        x: clampAxis(candidate.x, minX, maxX),
        y: clampAxis(candidate.y, minY, maxY),
      }
    }

    positions.push(candidate)
  }

  return positions
}
