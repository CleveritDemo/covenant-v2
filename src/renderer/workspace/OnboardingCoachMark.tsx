import React, { useLayoutEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { APP_OVERLAY_MODAL_Z } from '@shared/overlayZIndex'
import { isReduceMotionActive } from '../reduceMotion'
import './OnboardingCoachMark.css'

const HIGHLIGHT_PAD = 6

export interface OnboardingCoachMarkProps {
  /** Valor de `data-onboarding` del ancla. */
  anchor: string
  message: string
  stepLabel?: string
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

  const tooltipTop = Math.min(bottom + 12, vh - 120)
  const tooltipLeft = Math.min(Math.max(left + width / 2, 160), vw - 160)

  return createPortal(
    <div
      className="onboarding-coach-mark"
      style={{ zIndex: APP_OVERLAY_MODAL_Z - 20 }}
      role="presentation"
    >
      <div
        className="onboarding-coach-mark__block"
        style={{ top: 0, left: 0, width: vw, height: top }}
      />
      <div
        className="onboarding-coach-mark__block"
        style={{ top: bottom, left: 0, width: vw, height: Math.max(0, vh - bottom) }}
      />
      <div
        className="onboarding-coach-mark__block"
        style={{ top, left: 0, width: left, height }}
      />
      <div
        className="onboarding-coach-mark__block"
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
        className="onboarding-coach-mark__tooltip"
        style={{ top: tooltipTop, left: tooltipLeft }}
        role="status"
      >
        {stepLabel ? (
          <span className="onboarding-coach-mark__step">{stepLabel}</span>
        ) : null}
        <p className="onboarding-coach-mark__message">{message}</p>
      </div>
    </div>,
    document.body,
  )
}
