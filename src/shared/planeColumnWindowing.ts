import {
  PLANE_MINI_BOTTOM_CLEARANCE,
  PLANE_MINI_SLOT_GAP,
  PLANE_MINI_SLOT_PAD_Y,
} from '@shared/paneWindows'

export interface PlaneColumnItemSize {
  id: string
  height: number
}

export interface PlaneColumnWindowingInput {
  items: PlaneColumnItemSize[]
  viewportHeight: number
  scrollOffset: number
  padY?: number
  gap?: number
  bottomClearance?: number
  fadeZone?: number
  /** Si el contenido cabe sin scroll, anclar al borde inferior de la banda. */
  fitAlignment?: 'top' | 'bottom'
}

function smoothFadeProgress(linearRatio: number): number {
  const t = Math.min(1, Math.max(0, linearRatio))
  return t * t * (3 - 2 * t)
}

/** Escala máxima extra para la card de agente en el centro de la banda. */
export const PLANE_AGENT_CENTER_SCALE_BOOST = 0.06

export function centerProximityScale(proximity: number): number {
  const t = Math.min(1, Math.max(0, proximity))
  return Math.round((1 + t * PLANE_AGENT_CENTER_SCALE_BOOST) * 1000) / 1000
}

function computeCenterProximity(
  cardCenterY: number,
  bandTop: number,
  bandBottom: number,
): number {
  const bandCenter = (bandTop + bandBottom) / 2
  const halfBand = Math.max(1, (bandBottom - bandTop) / 2)
  const distance = Math.abs(cardCenterY - bandCenter)
  const linear = 1 - Math.min(1, distance / halfBand)
  return Math.round(smoothFadeProgress(linear) * 1000) / 1000
}

export interface PlaneColumnSlotY {
  id: string
  y: number
  height: number
  visible: boolean
  progress: number
  /** 1 en el centro vertical de la banda visible; 0 en los bordes. */
  centerProximity: number
}

export interface PlaneColumnWindowingResult {
  slots: PlaneColumnSlotY[]
  hiddenAbove: string[]
  hiddenBelow: string[]
  contentHeight: number
  maxScroll: number
  appliedScrollOffset: number
}

export function computePlaneColumnWindowing(
  input: PlaneColumnWindowingInput,
): PlaneColumnWindowingResult {
  const padY = input.padY ?? PLANE_MINI_SLOT_PAD_Y
  const gap = input.gap ?? PLANE_MINI_SLOT_GAP
  const bottomClearance = input.bottomClearance ?? PLANE_MINI_BOTTOM_CLEARANCE
  const fadeZone = input.fadeZone ?? 112
  const vh = input.viewportHeight > 0 ? input.viewportHeight : 640
  const items = input.items
  const n = items.length

  const heights = items.map(item => Math.max(0, Math.round(item.height)))
  const contentHeight = n === 0
    ? 0
    : padY + heights.reduce((sum, height) => sum + height, 0) + gap * (n - 1)

  const maxScroll = Math.max(0, contentHeight - (vh - bottomClearance))
  const appliedScrollOffset = Math.min(maxScroll, Math.max(0, input.scrollOffset))

  const bandTop = padY
  const bandBottom = Math.max(bandTop + 1, vh - bottomClearance)
  const fitAlignment = input.fitAlignment ?? 'top'
  const stackLift = fitAlignment === 'bottom'
    && maxScroll === 0
    && n > 0
    && contentHeight < bandBottom
    ? bandBottom - contentHeight
    : 0

  const slots: PlaneColumnSlotY[] = []
  const hiddenAbove: string[] = []
  const hiddenBelow: string[] = []

  let stackY = padY + stackLift
  for (let i = 0; i < n; i += 1) {
    const height = heights[i]
    const y = stackY - appliedScrollOffset
    const visible = y >= bandTop - 1 && y + height <= bandBottom + 1
    const overshootTop = Math.max(0, bandTop - y)
    const overshootBottom = Math.max(0, (y + height) - bandBottom)
    const overshoot = Math.max(overshootTop, overshootBottom)
    const linearProgress = Math.min(1, Math.max(0, 1 - overshoot / Math.max(1, fadeZone)))
    const progress = Math.round(smoothFadeProgress(linearProgress) * 1000) / 1000
    const centerProximity = computeCenterProximity(y + height / 2, bandTop, bandBottom)

    slots.push({ id: items[i].id, y, height, visible, progress, centerProximity })

    if (progress === 0) {
      if (y + height < bandTop) {
        hiddenAbove.push(items[i].id)
      } else {
        hiddenBelow.push(items[i].id)
      }
    }

    stackY += height + gap
  }

  return {
    slots,
    hiddenAbove,
    hiddenBelow,
    contentHeight,
    maxScroll,
    appliedScrollOffset,
  }
}
