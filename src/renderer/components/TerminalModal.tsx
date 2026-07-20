import React, { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useT } from '@i18n/useT'
import { Icon } from './ui/Icon'
import './TerminalModal.css'

export type TerminalModalSize = 'sm' | 'md' | 'lg' | 'xl' | 'xxl'
/** Variante del panel para casos de uso específicos (sin className en props). */
export type TerminalModalPanelVariant = 'default' | 'theme-picker'
/** Layout del cuerpo del modal. */
export type TerminalModalBodyLayout = 'default' | 'spacious' | 'flush'

export interface TerminalModalProps {
  open: boolean
  onClose: () => void
  /** Encabezado; si se omite, no se muestra barra superior */
  title?: React.ReactNode
  titleId?: string
  children: React.ReactNode
  footer?: React.ReactNode
  size?: TerminalModalSize
  /** Por defecto 640; confirmaciones históricas usan 600 */
  zIndex?: number
  closeOnEscape?: boolean
  /** Clic en el fondo oscuro; por defecto no cierra (usar ✕, Esc si aplica, o botones del pie). */
  closeOnBackdrop?: boolean
  /** Botón ✕ en la esquina del encabezado (solo si hay `title`) */
  showHeaderClose?: boolean
  panelVariant?: TerminalModalPanelVariant
  bodyLayout?: TerminalModalBodyLayout
}

/**
 * Contenedor común para modales de la app.
 * Sin props de className: el chrome solo se controla con size / panelVariant / bodyLayout.
 * Entrada y blur son CSS puro (sin clases JS): StrictMode no puede cancelar el efecto.
 */
export const TerminalModal: React.FC<TerminalModalProps> = ({
  open,
  onClose,
  title,
  titleId = 'terminal-modal-title',
  children,
  footer,
  size = 'md',
  zIndex = 640,
  closeOnEscape = true,
  closeOnBackdrop = false,
  showHeaderClose = true,
  panelVariant = 'default',
  bodyLayout = 'default',
}) => {
  const { t } = useT()
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const raf = requestAnimationFrame(() => {
      const panel = panelRef.current
      if (!panel) return
      const focusable = panel.querySelector<HTMLElement>(
        'input, button, select, textarea, [tabindex]:not([tabindex="-1"])',
      )
      ;(focusable ?? panel).focus()
    })
    return () => cancelAnimationFrame(raf)
  }, [open])

  useEffect(() => {
    if (!open || !closeOnEscape) return
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        onClose()
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [open, closeOnEscape, onClose])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent): void => {
      if (e.key !== 'Tab' || !panelRef.current) return
      const focusable = panelRef.current.querySelectorAll<HTMLElement>(
        'input, button, select, textarea, [tabindex]:not([tabindex="-1"])',
      )
      if (focusable.length === 0) return
      const first = focusable[0]!
      const last = focusable[focusable.length - 1]!
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [open])

  if (!open) return null

  const hasHeader = title != null && title !== ''

  const bodyClass = [
    'terminal-modal-body',
    bodyLayout !== 'default' ? `terminal-modal-body--${bodyLayout}` : '',
  ].filter(Boolean).join(' ')

  return createPortal(
    <div
      className="terminal-modal-root"
      style={{ '--modal-z': zIndex } as React.CSSProperties}
      role="presentation"
      onClick={closeOnBackdrop ? onClose : undefined}
    >
      <div className="terminal-modal-scrim" aria-hidden="true" />
      <div
        ref={panelRef}
        className={[
          'terminal-modal-panel',
          `terminal-modal-panel--${size}`,
          panelVariant !== 'default' ? `terminal-modal-panel--${panelVariant}` : '',
        ].filter(Boolean).join(' ')}
        role="dialog"
        aria-modal="true"
        aria-labelledby={hasHeader ? titleId : undefined}
        tabIndex={-1}
        onClick={e => e.stopPropagation()}
      >
        {hasHeader && (
          <header className="terminal-modal-header">
            <h2 className="terminal-modal-title" id={titleId}>{title}</h2>
            {showHeaderClose && (
              <button
                type="button"
                className="terminal-modal-header-close"
                onClick={onClose}
                title={t('ui.closeTitle')}
                aria-label={t('ui.closeAriaLabel')}
              >
                <Icon name="close" size={14} />
              </button>
            )}
          </header>
        )}
        <div className={bodyClass}>
          {children}
        </div>
        {footer != null && footer !== false && (
          <footer className="terminal-modal-footer">
            {footer}
          </footer>
        )}
      </div>
    </div>,
    document.body,
  )
}
