import React, { useEffect, useId, useRef } from 'react'
import { createPortal } from 'react-dom'
import { GravityHeroCanvas } from './GravityHeroCanvas'
import './HeroConfirmOverlay.css'

type ConfirmProps = {
  variant?: 'confirm'
  open: boolean
  /** Pregunta o decisión principal. */
  title: string
  /** Contexto breve encima del título (p. ej. terminales abiertas). */
  meta?: string
  /** Meta breve debajo (atajos, contexto secundario). */
  hint?: string
  zIndex?: number
  onConfirm: () => void
  onCancel: () => void
}

type BusyProps = {
  variant: 'busy'
  open: boolean
  /** Título principal mientras hay trabajo en curso. */
  title: string
  /** Texto pequeño encima: qué está cargando. */
  meta?: string
  /** Estado / progreso debajo (aria-describedby). */
  status?: string
  zIndex?: number
}

type Props = ConfirmProps | BusyProps

function isBusyProps(props: Props): props is BusyProps {
  return props.variant === 'busy'
}

/**
 * Overlay tipográfico a pantalla completa sobre GravityHeroCanvas.
 * - confirm: Esc cancela; Enter confirma.
 * - busy: aria-busy; sin teclas confirm/cancel.
 */
export const HeroConfirmOverlay: React.FC<Props> = (props) => {
  const { open, title, zIndex } = props
  const busy = isBusyProps(props)
  const titleId = useId()
  const metaId = useId()
  const secondaryId = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const onConfirm = busy ? undefined : props.onConfirm
  const onCancel = busy ? undefined : props.onCancel
  const meta = props.meta
  const hint = busy ? undefined : props.hint
  const status = busy ? props.status : undefined

  useEffect(() => {
    if (!open) return
    const raf = requestAnimationFrame(() => {
      rootRef.current?.focus()
    })
    return () => cancelAnimationFrame(raf)
  }, [open])

  useEffect(() => {
    if (!open || busy || !onConfirm || !onCancel) return
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        onCancel()
        return
      }
      if (e.key === 'Enter') {
        e.preventDefault()
        e.stopPropagation()
        onConfirm()
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [open, busy, onConfirm, onCancel])

  if (!open) return null

  const describedBy = [
    meta ? metaId : null,
    hint || status ? secondaryId : null,
  ].filter(Boolean).join(' ') || undefined

  return createPortal(
    <GravityHeroCanvas
      ref={rootRef}
      enter="fade"
      zIndex={zIndex}
      role="dialog"
      aria-modal
      aria-busy={busy || undefined}
      aria-labelledby={titleId}
      aria-describedby={describedBy}
      tabIndex={-1}
    >
      <div className="hero-confirm-overlay__copy">
        {meta ? (
          <p className="hero-confirm-overlay__meta" id={metaId}>{meta}</p>
        ) : null}
        <h2 className="hero-confirm-overlay__title" id={titleId}>{title}</h2>
        {hint ? (
          <p className="hero-confirm-overlay__hint" id={secondaryId}>{hint}</p>
        ) : null}
        {status ? (
          <p className="hero-confirm-overlay__status" id={secondaryId}>{status}</p>
        ) : null}
      </div>
    </GravityHeroCanvas>,
    document.body,
  )
}
