import React, { useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ONBOARDING_COACH_MARK_Z } from '@shared/overlayZIndex'
import { resolveCoachMarkTooltipTop } from '@shared/onboardingCoachMarkGeometry'
import { Button } from '../components/ui'
import { isReduceMotionActive } from '../reduceMotion'
import './OnboardingCoachMark.css'

const HIGHLIGHT_PAD = 6

export interface OnboardingCoachMarkProps {
  /** Valor de `data-onboarding` del ancla. */
  anchor: string
  message: string
  stepLabel?: string
  /** Cierra un paso sin acción anclada. Junto con `dismissLabel` pinta el botón. */
  onDismiss?: () => void
  dismissLabel?: string
  /**
   * Con `blocking=false` el scrim se pinta pero deja pasar los clics al plano
   * (pasos informativos). Por defecto `true`.
   */
  blocking?: boolean
  /** Raíz del plano de la tab activa; si falta, cae a document. */
  scopeRef?: React.RefObject<HTMLElement | null>
}

type Rect = {
  top: number
  left: number
  width: number
  height: number
}

function queryAnchor(anchor: string, scope: ParentNode | null): Element | null {
  return (scope ?? document).querySelector(`[data-onboarding="${anchor}"]`)
}

function measureAnchor(anchor: string, scope: ParentNode | null): Rect | null {
  const el = queryAnchor(anchor, scope)
  if (!el) return null
  const r = el.getBoundingClientRect()
  if (r.width <= 0 && r.height <= 0) return null
  return {
    top: r.top - HIGHLIGHT_PAD,
    left: r.left - HIGHLIGHT_PAD,
    width: r.width + HIGHLIGHT_PAD * 2,
    height: r.height + HIGHLIGHT_PAD * 2,
  }
}

/**
 * Coach mark anclado al UI real: scrim, highlight y tooltip sobrios.
 * El ancla sigue interactivo; el resto del plano queda bloqueado.
 */
export const OnboardingCoachMark: React.FC<OnboardingCoachMarkProps> = ({
  anchor,
  message,
  stepLabel,
  onDismiss,
  dismissLabel,
  blocking = true,
  scopeRef,
}) => {
  const [rect, setRect] = useState<Rect | null>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)
  const [tooltipH, setTooltipH] = useState(96)
  const reduceMotion = isReduceMotionActive()

  useLayoutEffect(() => {
    // Hoy un paso cuya ancla monta un commit después queda sin rect y sin reintento,
    // así que el coach mark no se pinta nunca y el usuario se queda sin guía.
    const scope = scopeRef?.current ?? null
    const sync = (): void => {
      setRect(measureAnchor(anchor, scope))
    }
    sync()
    const el = queryAnchor(anchor, scope)

    let mo: MutationObserver | null = null
    let ro: ResizeObserver | null = null
    let listening = false

    const bindTarget = (target: Element): void => {
      if (listening) return
      listening = true
      ro = typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(sync)
        : null
      ro?.observe(target)
      window.addEventListener('scroll', sync, true)
      window.addEventListener('resize', sync)
    }

    if (!el) {
      if (typeof MutationObserver !== 'undefined') {
        mo = new MutationObserver(() => {
          const found = queryAnchor(anchor, scope)
          if (!found) return
          sync()
          mo?.disconnect()
          mo = null
          bindTarget(found)
        })
        mo.observe(scope ?? document.body, { childList: true, subtree: true })
      }
    } else {
      bindTarget(el)
    }

    return () => {
      mo?.disconnect()
      ro?.disconnect()
      window.removeEventListener('scroll', sync, true)
      window.removeEventListener('resize', sync)
    }
  }, [anchor, scopeRef])

  useLayoutEffect(() => {
    const h = tooltipRef.current?.getBoundingClientRect().height ?? 0
    if (h > 0 && h !== tooltipH) {
      setTooltipH(h)
    }
  }, [anchor, message, rect])

  if (!rect || typeof document === 'undefined') return null

  const vw = window.innerWidth
  const vh = window.innerHeight
  const { top, left, width, height } = rect
  const bottom = top + height
  const right = left + width

  const { top: tooltipTop, above: tooltipAbove } = resolveCoachMarkTooltipTop({
    anchorTop: top,
    anchorBottom: bottom,
    tooltipHeight: tooltipH,
    viewportHeight: vh,
  })
  const tooltipLeft = Math.min(Math.max(left + width / 2, 160), vw - 160)

  const blockClass = [
    'onboarding-coach-mark__block',
    blocking ? '' : 'onboarding-coach-mark__block--pass',
  ].filter(Boolean).join(' ')
  const blockMode = blocking ? 'solid' : 'pass'

  return createPortal(
    <div
      className="onboarding-coach-mark"
      style={{ zIndex: ONBOARDING_COACH_MARK_Z }}
      role="presentation"
    >
      <div
        className={blockClass}
        data-onboarding-block={blockMode}
        style={{ top: 0, left: 0, width: vw, height: top }}
      />
      <div
        className={blockClass}
        data-onboarding-block={blockMode}
        style={{ top: bottom, left: 0, width: vw, height: Math.max(0, vh - bottom) }}
      />
      <div
        className={blockClass}
        data-onboarding-block={blockMode}
        style={{ top, left: 0, width: left, height }}
      />
      <div
        className={blockClass}
        data-onboarding-block={blockMode}
        style={{ top, left: right, width: Math.max(0, vw - right), height }}
      />
      <div
        className={[
          'onboarding-coach-mark__highlight',
          reduceMotion ? '' : 'onboarding-coach-mark__highlight--pulse',
        ].filter(Boolean).join(' ')}
        style={{ top, left, width, height }}
        aria-hidden
      />
      <div
        ref={tooltipRef}
        className={[
          'onboarding-coach-mark__tooltip',
          tooltipAbove ? 'onboarding-coach-mark__tooltip--above' : '',
          onDismiss ? 'onboarding-coach-mark__tooltip--actionable' : '',
        ].filter(Boolean).join(' ')}
        style={{ top: tooltipTop, left: tooltipLeft }}
        role="status"
      >
        {stepLabel ? (
          <span className="onboarding-coach-mark__step">{stepLabel}</span>
        ) : null}
        <p className="onboarding-coach-mark__message">{message}</p>
        {onDismiss && dismissLabel ? (
          <div className="onboarding-coach-mark__actions">
            <Button variant="ghost" size="sm" onClick={onDismiss}>
              {dismissLabel}
            </Button>
          </div>
        ) : null}
      </div>
    </div>,
    document.body,
  )
}
