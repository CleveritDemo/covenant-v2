import React, { useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import './Tooltip.css'

export interface TooltipProps {
  content: string
  children: React.ReactNode
}

interface TooltipPosition {
  left: number
  top: number
  side: 'top' | 'bottom'
}

export const Tooltip: React.FC<TooltipProps> = ({ content, children }) => {
  const anchorRef = useRef<HTMLSpanElement>(null)
  const bubbleRef = useRef<HTMLSpanElement>(null)
  const [visible, setVisible] = useState(false)
  const [pos, setPos] = useState<TooltipPosition>({ left: 0, top: 0, side: 'top' })

  useLayoutEffect(() => {
    if (!visible) return

    const updatePosition = (): void => {
      const anchor = anchorRef.current
      const bubble = bubbleRef.current
      if (!anchor || !bubble) return

      const rect = anchor.getBoundingClientRect()
      const bubbleRect = bubble.getBoundingClientRect()
      const margin = 10
      const gap = 10

      let side: TooltipPosition['side'] = 'top'
      let top = rect.top - gap
      if (top - bubbleRect.height < margin) {
        side = 'bottom'
        top = rect.bottom + gap
      }

      const minLeft = margin + bubbleRect.width / 2
      const maxLeft = window.innerWidth - margin - bubbleRect.width / 2
      const left = Math.min(maxLeft, Math.max(minLeft, rect.left + rect.width / 2))
      setPos({ left, top, side })
    }

    updatePosition()
    window.addEventListener('scroll', updatePosition, true)
    window.addEventListener('resize', updatePosition)
    return () => {
      window.removeEventListener('scroll', updatePosition, true)
      window.removeEventListener('resize', updatePosition)
    }
  }, [visible, content])

  if (!content) return <>{children}</>

  return (
    <span
      ref={anchorRef}
      className="ui-tooltip"
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
      onFocus={() => setVisible(true)}
      onBlur={() => setVisible(false)}
    >
      {children}
      {visible && createPortal(
        <span
          ref={bubbleRef}
          className={`ui-tooltip-bubble ui-tooltip-bubble--${pos.side}`}
          style={{ left: `${pos.left}px`, top: `${pos.top}px` }}
          role="tooltip"
        >
          {content}
        </span>,
        document.body,
      )}
    </span>
  )
}
