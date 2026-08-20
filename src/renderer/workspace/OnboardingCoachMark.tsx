import React, { useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ONBOARDING_COACH_MARK_Z } from '@shared/overlayZIndex'
import {
  resolveCoachCalloutLayout,
  type CoachCalloutRect,
  type CoachCalloutSide,
} from '@shared/onboardingCalloutPlacement'
import { Button } from '../components/ui'
import './OnboardingCoachMark.css'

/** Aire entre el control y el globo: deja pasar el aro y su halo. */
const CALLOUT_GAP = 28

/** Margen contra el borde de la ventana. */
const VIEWPORT_MARGIN = 12

/** Medida supuesta del globo hasta que el DOM lo mide (y en jsdom). */
const CALLOUT_FALLBACK = { width: 264, height: 96 }

/** Aire por defecto del aro; el mismo valor que abre OnboardingCoachMark.css. */
const DEFAULT_COACH_AIR = 8

/** Sobre el aire: trazo del aro (2px) y holgura para el halo. */
const HOLE_EXTRA = 10

/** Clase que se pone en el control real: él late en radar, sin div aparte. */
export const ONBOARDING_COACH_TARGET_CLASS = 'onboarding-coach-target'

/**
 * Lado pedido por ancla cuando la colocación automática no es la que se quiere.
 * Es una preferencia, no una orden: si de ese lado no cabe el globo, vuelve el
 * orden normal. La tarjeta de tipo vive en una rejilla de chips y el texto se
 * lee mejor a su derecha que tapando la fila de abajo.
 */
const PREFERRED_SIDE_BY_ANCHOR: Record<string, CoachCalloutSide> = {
  'context-kind': 'right',
}

/** Controles que pueden llevar el radar cuando el ancla es solo un envoltorio. */
const CONTROL_SELECTOR = 'button, a[href], [role="button"], input, textarea, select'

export interface CoachTargetMeasure {
  rect: CoachCalloutRect
  /** Cuánto se agranda el hueco del velo alrededor del control. */
  holePad: number
}

export interface OnboardingCoachMarkProps {
  /** Valor de `data-onboarding` del ancla. */
  anchor: string
  /** Acción concreta del paso, en una línea. */
  title?: string
  message: string
  /** Cierra el paso con OK. Junto con `dismissLabel` pinta el botón. */
  onDismiss?: () => void
  dismissLabel?: string
  /** OK a la vista pero apagado: falta hacer lo que el paso pide. */
  dismissDisabled?: boolean
}

/**
 * Un mismo `data-onboarding` puede existir varias veces: las tabs inactivas
 * siguen montadas y el composer del curador wiki reusa el shell del plano. Un
 * `querySelector` a secas devolvía la copia oculta (caja 0×0) y el coach no
 * pintaba nada. Gana la primera copia VISIBLE; si ninguna lo es, la primera,
 * para que el observer de anclas tardías siga teniendo a quién esperar.
 */
function queryAnchor(anchor: string): HTMLElement | null {
  const found = Array.from(
    document.querySelectorAll<HTMLElement>(`[data-onboarding="${anchor}"]`),
  )
  if (found.length === 0) return null
  const visible = found.find((el) => {
    const r = el.getBoundingClientRect()
    return r.width > 0 || r.height > 0
  })
  return visible ?? found[0]
}

/**
 * El radar va en el control, no en el envoltorio: si el ancla es un `span` que
 * solo abraza un botón, el aro seguiría una caja cuadrada y descolocada. Baja un
 * único nivel y solo si ahí hay un control; con varios hijos (la frase del
 * brainstorm) o con un hijo que no es control (el shell del pool) manda el ancla.
 */
export function resolveCoachTarget(anchorEl: HTMLElement): HTMLElement {
  if (anchorEl.matches(CONTROL_SELECTOR)) return anchorEl
  const children = Array.from(anchorEl.children).filter(
    (child): child is HTMLElement => child instanceof HTMLElement,
  )
  if (children.length !== 1) return anchorEl
  return children[0].matches(CONTROL_SELECTOR) ? children[0] : anchorEl
}

/**
 * El hueco del velo sale del aire real del aro (`--onboarding-coach-air`, que
 * cambia por ancla) más el trazo y el halo, para no apagar el radar.
 */
function readHolePad(target: HTMLElement): number {
  if (typeof getComputedStyle !== 'function') return DEFAULT_COACH_AIR + HOLE_EXTRA
  const raw = getComputedStyle(target)
    .getPropertyValue('--onboarding-coach-air')
    .trim()
  const air = raw ? Number.parseFloat(raw) : Number.NaN
  const safe = Number.isFinite(air) ? Math.max(0, air) : DEFAULT_COACH_AIR
  return safe + HOLE_EXTRA
}

/** Dos medidas iguales no deben re-renderizar: el bucle corre por frame. */
export function coachMeasuresEqual(
  a: CoachTargetMeasure | null,
  b: CoachTargetMeasure | null,
): boolean {
  if (a === null || b === null) return a === b
  return Math.abs(a.rect.top - b.rect.top) < 0.5
    && Math.abs(a.rect.left - b.rect.left) < 0.5
    && Math.abs(a.rect.width - b.rect.width) < 0.5
    && Math.abs(a.rect.height - b.rect.height) < 0.5
    && a.holePad === b.holePad
}

function measureTarget(anchor: string): CoachTargetMeasure | null {
  const el = queryAnchor(anchor)
  if (!el) return null
  const target = resolveCoachTarget(el)
  const r = target.getBoundingClientRect()
  if (r.width <= 0 && r.height <= 0) return null
  return {
    rect: { top: r.top, left: r.left, width: r.width, height: r.height },
    holePad: readHolePad(target),
  }
}

/**
 * Globo del onboarding: el control señalado late en radar (clase en el DOM) y
 * el globo lo apunta con una punta desde el lado con aire. Alrededor va un velo
 * suave con hueco en el control: oscurece el resto sin sellarlo, así que el
 * usuario puede seguir operando el plano.
 */
export const OnboardingCoachMark: React.FC<OnboardingCoachMarkProps> = ({
  anchor,
  title,
  message,
  onDismiss,
  dismissLabel,
  dismissDisabled = false,
}) => {
  const [measure, setMeasure] = useState<CoachTargetMeasure | null>(null)
  const [cardSize, setCardSize] = useState(CALLOUT_FALLBACK)
  const cardRef = useRef<HTMLDivElement | null>(null)

  useLayoutEffect(() => {
    let tagged: HTMLElement | null = null
    let current: CoachTargetMeasure | null = null
    let frame = 0

    const clearTag = (): void => {
      tagged?.classList.remove(ONBOARDING_COACH_TARGET_CLASS)
      tagged = null
    }

    const tagTarget = (target: HTMLElement): void => {
      if (tagged === target) return
      clearTag()
      target.classList.add(ONBOARDING_COACH_TARGET_CLASS)
      tagged = target
    }

    /**
     * Se remide por frame comparando el resultado: el control se mueve por cosas
     * que ni scroll ni resize avisan —abrir el chat empuja el composer, el riel
     * hace scroll, el ancla se monta tarde— y con la medida vieja el globo
     * apunta a donde el control estaba. Solo hay estado nuevo si algo cambió.
     */
    const tick = (): void => {
      const found = queryAnchor(anchor)
      if (found) tagTarget(resolveCoachTarget(found))
      else clearTag()
      const next = measureTarget(anchor)
      if (!coachMeasuresEqual(current, next)) {
        current = next
        setMeasure(next)
      }
      if (typeof requestAnimationFrame === 'function') {
        frame = requestAnimationFrame(tick)
      }
    }
    tick()

    return () => {
      clearTag()
      if (frame && typeof cancelAnimationFrame === 'function') {
        cancelAnimationFrame(frame)
      }
    }
  }, [anchor])

  useLayoutEffect(() => {
    const card = cardRef.current
    if (!card) return
    const r = card.getBoundingClientRect()
    if (r.width <= 0 || r.height <= 0) return
    setCardSize((prev) => (
      Math.abs(prev.width - r.width) < 1 && Math.abs(prev.height - r.height) < 1
        ? prev
        : { width: r.width, height: r.height }
    ))
  }, [title, message, dismissLabel, measure])

  if (!measure || typeof document === 'undefined') return null

  const { rect, holePad } = measure
  const layout = resolveCoachCalloutLayout({
    anchor: rect,
    card: cardSize,
    viewport: { width: window.innerWidth, height: window.innerHeight },
    gap: CALLOUT_GAP,
    margin: VIEWPORT_MARGIN,
    ...(PREFERRED_SIDE_BY_ANCHOR[anchor]
      ? { preferSide: PREFERRED_SIDE_BY_ANCHOR[anchor] }
      : {}),
  })
  const caretStyle = layout.side === 'right' || layout.side === 'left'
    ? { top: layout.caretOffset }
    : { left: layout.caretOffset }

  const vw = window.innerWidth
  const vh = window.innerHeight
  const holeTop = rect.top - holePad
  const holeLeft = rect.left - holePad
  const holeBottom = rect.top + rect.height + holePad
  const holeRight = rect.left + rect.width + holePad

  return createPortal(
    <div
      className="onboarding-coach-mark"
      style={{ zIndex: ONBOARDING_COACH_MARK_Z }}
      role="presentation"
    >
      <div
        className="onboarding-coach-mark__veil"
        style={{ top: 0, left: 0, width: vw, height: Math.max(0, holeTop) }}
      />
      <div
        className="onboarding-coach-mark__veil"
        style={{ top: holeBottom, left: 0, width: vw, height: Math.max(0, vh - holeBottom) }}
      />
      <div
        className="onboarding-coach-mark__veil"
        style={{
          top: Math.max(0, holeTop),
          left: 0,
          width: Math.max(0, holeLeft),
          height: Math.max(0, holeBottom - Math.max(0, holeTop)),
        }}
      />
      <div
        className="onboarding-coach-mark__veil"
        style={{
          top: Math.max(0, holeTop),
          left: holeRight,
          width: Math.max(0, vw - holeRight),
          height: Math.max(0, holeBottom - Math.max(0, holeTop)),
        }}
      />
      <div
        ref={cardRef}
        className={[
          'onboarding-coach-mark__callout',
          `onboarding-coach-mark__callout--${layout.side}`,
          onDismiss ? 'onboarding-coach-mark__callout--actionable' : '',
        ].filter(Boolean).join(' ')}
        style={{ top: layout.top, left: layout.left }}
        role="status"
      >
        <span
          className="onboarding-coach-mark__caret"
          style={caretStyle}
          aria-hidden="true"
        />
        {title ? (
          <p className="onboarding-coach-mark__title">{title}</p>
        ) : null}
        <p className="onboarding-coach-mark__message">{message}</p>
        {onDismiss && dismissLabel ? (
          <div className="onboarding-coach-mark__actions">
            <Button
              variant="primary"
              size="sm"
              disabled={dismissDisabled}
              onClick={onDismiss}
            >
              {dismissLabel}
            </Button>
          </div>
        ) : null}
      </div>
    </div>,
    document.body,
  )
}
