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
}

export interface PlaneColumnSlotY {
  id: string
  y: number
  height: number
  visible: boolean
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

  const slots: PlaneColumnSlotY[] = []
  const hiddenAbove: string[] = []
  const hiddenBelow: string[] = []

  let stackY = padY
  for (let i = 0; i < n; i += 1) {
    const height = heights[i]
    const y = stackY - appliedScrollOffset
    const visible = y >= bandTop - 1 && y + height <= bandBottom + 1

    slots.push({ id: items[i].id, y, height, visible })

    if (!visible) {
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
