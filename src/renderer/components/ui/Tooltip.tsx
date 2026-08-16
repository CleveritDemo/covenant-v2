import React, { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import './Tooltip.css'

export interface TooltipProps {
  content: string
  /** Segunda línea atenuada: la pista de interacción ("clic para editar · arrastra…"). */
  hint?: string
  children: React.ReactNode
}

interface TooltipPosition {
  left: number
  top: number
  side: 'top' | 'bottom'
  /** Offset de la flecha desde el borde izquierdo de la burbuja, en px. */
  arrow: number
}

const OPEN_DELAY_MS = 400
/** Tras cerrar uno, los vecinos abren sin espera durante esta ventana. */
const WARM_MS = 300
/** Distancia mínima de la flecha a las esquinas de la burbuja. */
const ARROW_INSET = 12

// ponytail: módulo, no context — solo hay un tooltip visible a la vez en toda la app.
let warmUntil = 0

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value))

export const Tooltip: React.FC<TooltipProps> = ({ content, hint, children }) => {
  const anchorRef = useRef<HTMLSpanElement>(null)
  const bubbleRef = useRef<HTMLSpanElement>(null)
  const timerRef = useRef<number | undefined>(undefined)
  const [visible, setVisible] = useState(false)
  const [pos, setPos] = useState<TooltipPosition>({ left: 0, top: 0, side: 'top', arrow: 0 })

  useEffect(() => () => window.clearTimeout(timerRef.current), [])

  useLayoutEffect(() => {
    if (!visible) return

    const updatePosition = (): void => {
      const anchor = anchorRef.current
      const bubble = bubbleRef.current
      if (!anchor || !bubble) return

      const rect = anchor.getBoundingClientRect()
      const bubbleRect = bubble.getBoundingClientRect()
      // La tinta puede exceder la caja cuando el hint no envuelve aún (ruta sin espacios).
      const bubbleWidth = Math.max(bubbleRect.width, bubble.scrollWidth)
      const margin = 10
      const gap = 10

      let side: TooltipPosition['side'] = 'top'
      let top = rect.top - gap
      if (top - bubbleRect.height < margin) {
        side = 'bottom'
        top = rect.bottom + gap
      }

      const center = rect.left + rect.width / 2
      const minLeft = margin + bubbleWidth / 2
      const maxLeft = window.innerWidth - margin - bubbleWidth / 2
      const left = clamp(center, minLeft, maxLeft)
      // La burbuja se recorta contra el borde, la flecha sigue apuntando al ancla.
      const arrow = clamp(
        center - (left - bubbleWidth / 2),
        ARROW_INSET,
        bubbleWidth - ARROW_INSET,
      )
      setPos({ left, top, side, arrow })
    }

    updatePosition()
    window.addEventListener('scroll', updatePosition, true)
    window.addEventListener('resize', updatePosition)
    return () => {
      window.removeEventListener('scroll', updatePosition, true)
      window.removeEventListener('resize', updatePosition)
    }
  }, [visible, content, hint])

  if (!content) return <>{children}</>

  const open = (): void => {
    window.clearTimeout(timerRef.current)
    timerRef.current = window.setTimeout(
      () => setVisible(true),
      Date.now() < warmUntil ? 0 : OPEN_DELAY_MS,
    )
  }

  const close = (): void => {
    window.clearTimeout(timerRef.current)
    if (visible) warmUntil = Date.now() + WARM_MS
    setVisible(false)
  }

  return (
    <span
      ref={anchorRef}
      className="ui-tooltip"
      onMouseEnter={open}
      onMouseLeave={close}
      onFocus={open}
      onBlur={close}
      onClick={close}
    >
      {children}
      {visible && createPortal(
        <span
          ref={bubbleRef}
          className={`ui-tooltip-bubble ui-tooltip-bubble--${pos.side}`}
          style={{ left: `${pos.left}px`, top: `${pos.top}px`, ['--ui-tooltip-arrow' as string]: `${pos.arrow}px` }}
          role="tooltip"
        >
          <span className="ui-tooltip-bubble__main">{content}</span>
          {hint ? <span className="ui-tooltip-bubble__hint">{hint}</span> : null}
        </span>,
        document.body,
      )}
    </span>
  )
}
