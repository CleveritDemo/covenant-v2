/**
 * Geometría del globo del onboarding: decide de qué lado del control se pinta
 * y dónde queda la punta que lo señala. Puro para poder fijarlo en tests.
 */

export type CoachCalloutSide = 'right' | 'left' | 'bottom' | 'top'

export interface CoachCalloutRect {
  top: number
  left: number
  width: number
  height: number
}

export interface CoachCalloutSize {
  width: number
  height: number
}

export interface ResolveCoachCalloutArgs {
  /** Caja del control señalado, en coordenadas de viewport. */
  anchor: CoachCalloutRect
  /** Medida real del globo (medida en el DOM; en jsdom llega el fallback). */
  card: CoachCalloutSize
  viewport: CoachCalloutSize
  /** Aire entre el borde del control y el globo: deja respirar al radar. */
  gap: number
  /** Margen mínimo contra el borde de la ventana. */
  margin: number
  /** Lado que se intenta primero si cabe; si no cabe, manda el orden normal. */
  preferSide?: CoachCalloutSide
}

export interface CoachCalloutLayout {
  side: CoachCalloutSide
  top: number
  left: number
  /** Centro de la punta medido dentro del globo, desde su borde superior o izquierdo. */
  caretOffset: number
}

/** Distancia mínima de la punta a la esquina del globo. */
export const COACH_CARET_INSET = 18

/** Un control más ancho que esto se señala por arriba/abajo, no por el costado. */
const WIDE_ANCHOR = 260

function clamp(value: number, min: number, max: number): number {
  if (max < min) return min
  return Math.min(Math.max(value, min), max)
}

/**
 * Controles angostos (botones del rail, chips) se señalan de costado; los anchos
 * (composer, columnas, campos) por debajo, que es donde queda aire.
 */
export function coachCalloutSideOrder(
  anchor: CoachCalloutRect,
  preferSide?: CoachCalloutSide,
): CoachCalloutSide[] {
  const base: CoachCalloutSide[] = anchor.width > WIDE_ANCHOR
    ? ['bottom', 'top', 'right', 'left']
    : ['right', 'left', 'bottom', 'top']
  if (!preferSide) return base
  return [preferSide, ...base.filter(side => side !== preferSide)]
}

function fits(side: CoachCalloutSide, args: ResolveCoachCalloutArgs): boolean {
  const { anchor, card, viewport, gap, margin } = args
  if (side === 'right') {
    return anchor.left + anchor.width + gap + card.width + margin <= viewport.width
  }
  if (side === 'left') {
    return anchor.left - gap - card.width - margin >= 0
  }
  if (side === 'bottom') {
    return anchor.top + anchor.height + gap + card.height + margin <= viewport.height
  }
  return anchor.top - gap - card.height - margin >= 0
}

export function resolveCoachCalloutLayout(args: ResolveCoachCalloutArgs): CoachCalloutLayout {
  const { anchor, card, viewport, gap, margin } = args
  const order = coachCalloutSideOrder(anchor, args.preferSide)
  const side = order.find((candidate) => fits(candidate, args)) ?? order[0]

  const centerX = anchor.left + anchor.width / 2
  const centerY = anchor.top + anchor.height / 2

  if (side === 'right' || side === 'left') {
    const left = side === 'right'
      ? anchor.left + anchor.width + gap
      : anchor.left - gap - card.width
    const top = clamp(
      centerY - card.height / 2,
      margin,
      viewport.height - card.height - margin,
    )
    return {
      side,
      left: clamp(left, margin, Math.max(margin, viewport.width - card.width - margin)),
      top,
      caretOffset: clamp(
        centerY - top,
        COACH_CARET_INSET,
        Math.max(COACH_CARET_INSET, card.height - COACH_CARET_INSET),
      ),
    }
  }

  const top = side === 'bottom'
    ? anchor.top + anchor.height + gap
    : anchor.top - gap - card.height
  const left = clamp(
    centerX - card.width / 2,
    margin,
    Math.max(margin, viewport.width - card.width - margin),
  )
  return {
    side,
    left,
    top: clamp(top, margin, Math.max(margin, viewport.height - card.height - margin)),
    caretOffset: clamp(
      centerX - left,
      COACH_CARET_INSET,
      Math.max(COACH_CARET_INSET, card.width - COACH_CARET_INSET),
    ),
  }
}
