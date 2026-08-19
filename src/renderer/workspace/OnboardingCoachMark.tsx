import React, { useLayoutEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { APP_OVERLAY_MODAL_Z } from '@shared/overlayZIndex'
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
}

type Rect = {
  top: number
  left: number
  width: number
  height: number
}

function queryAnchor(anchor: string): Element | null {
  return document.querySelector(`[data-onboarding="${anchor}"]`)
}

function measureAnchor(anchor: string): Rect | null {
  const el = queryAnchor(anchor)
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
}) => {
  const [rect, setRect] = useState<Rect | null>(null)
  const reduceMotion = isReduceMotionActive()

  useLayoutEffect(() => {
    const sync = (): void => {
      setRect(measureAnchor(anchor))
    }
    sync()
    const el = queryAnchor(anchor)
    if (!el) return

    const ro = typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(sync)
      : null
    ro?.observe(el)
    window.addEventListener('scroll', sync, true)
    window.addEventListener('resize', sync)

    return () => {
      ro?.disconnect()
      window.removeEventListener('scroll', sync, true)
      window.removeEventListener('resize', sync)
    }
  }, [anchor])

  if (!rect || typeof document === 'undefined') return null

  const vw = window.innerWidth
  const vh = window.innerHeight
  const { top, left, width, height } = rect
  const bottom = top + height
  const right = left + width

  const tooltipAbove = bottom + 12 + 96 > vh
  const tooltipTop = tooltipAbove ? Math.max(12, top - 12) : bottom + 12
  const tooltipLeft = Math.min(Math.max(left + width / 2, 160), vw - 160)

  const blockClass = [
    'onboarding-coach-mark__block',
    blocking ? '' : 'onboarding-coach-mark__block--pass',
  ].filter(Boolean).join(' ')
  const blockMode = blocking ? 'solid' : 'pass'

  return createPortal(
    <div
      className="onboarding-coach-mark"
      style={{ zIndex: APP_OVERLAY_MODAL_Z - 20 }}
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
