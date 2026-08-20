export interface CoachMarkTooltipTopArgs {
  anchorTop: number
  anchorBottom: number
  tooltipHeight: number
  viewportHeight: number
  gap?: number
  margin?: number
}

export interface CoachMarkTooltipTopResult {
  top: number
  above: boolean
}

/** Posición vertical del tooltip: arriba o abajo del ancla, con clamp al viewport. */
export function resolveCoachMarkTooltipTop({
  anchorTop,
  anchorBottom,
  tooltipHeight,
  viewportHeight,
  gap = 12,
  margin = 8,
}: CoachMarkTooltipTopArgs): CoachMarkTooltipTopResult {
  const above =
    anchorBottom + gap + tooltipHeight > viewportHeight &&
    anchorTop - gap - tooltipHeight >= margin

  const rawTop = above
    ? anchorTop - gap - tooltipHeight
    : anchorBottom + gap

  const top = Math.min(
    Math.max(rawTop, margin),
    Math.max(margin, viewportHeight - tooltipHeight - margin),
  )

  return { top, above }
}
