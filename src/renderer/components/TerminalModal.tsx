import React, { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useT } from '@i18n/useT'
import './TerminalModal.css'

export type TerminalModalSize = 'sm' | 'md' | 'lg' | 'xl' | 'xxl'
/** Variante del panel para casos de uso específicos (sin className en props). */
export type TerminalModalPanelVariant = 'default' | 'theme-picker'
/** Layout del cuerpo del modal. */
export type TerminalModalBodyLayout = 'default' | 'spacious' | 'flush'

export interface TerminalModalProps {
  open: boolean
  onClose: () => void
  /** Encabezado simple (h2) en la titlebar junto a los traffic lights. */
  title?: React.ReactNode
  /**
   * Encabezado rico (hero, avatar, etc.). Se renderiza debajo de la titlebar macOS.
   */
  headerContent?: React.ReactNode
  titleId?: string
  children: React.ReactNode
  footer?: React.ReactNode
  size?: TerminalModalSize
  /** Por defecto 640; confirmaciones históricas usan 600 */
  zIndex?: number
  closeOnEscape?: boolean
  /** Clic en el fondo oscuro; por defecto no cierra (usar traffic rojo, Esc si aplica, o botones del pie). */
  closeOnBackdrop?: boolean
  panelVariant?: TerminalModalPanelVariant
  bodyLayout?: TerminalModalBodyLayout
  /**
   * Si false, no se monta el portal (p. ej. tab inactiva).
   * El padre puede conservar `open` sin auto-cerrar al cambiar de tab.
   */
  active?: boolean
}

const FOCUSABLE_SELECTOR = [
  'textarea:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'button:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ')

function modalRootZ(el: HTMLElement): number {
  const fromVar = el.style.getPropertyValue('--modal-z').trim()
  const raw = fromVar || getComputedStyle(el).zIndex
  const n = Number(raw)
  return Number.isFinite(n) ? n : 0
}

/** Solo el modal superior (mayor z-index; empate → el último en el DOM) atrapa foco/Esc. */
function isTopmostModalRoot(root: HTMLElement): boolean {
  const roots = Array.from(document.querySelectorAll<HTMLElement>('.terminal-modal-root'))
  if (roots.length <= 1) return true
  let topZ = -Infinity
  for (const el of roots) topZ = Math.max(topZ, modalRootZ(el))
  const topRoots = roots.filter(el => modalRootZ(el) === topZ)
  return topRoots[topRoots.length - 1] === root
}

function firstFocusTarget(panel: HTMLElement): HTMLElement {
  // Preferir campos editables (Find/Settings/Commit); si no, el panel (no el 1.er botón).
  const nodes = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))
    .filter(el => !el.classList.contains('terminal-modal-traffic-btn'))
  const editable = nodes.find(el => {
    const tag = el.tagName
    return tag === 'TEXTAREA' || tag === 'INPUT' || tag === 'SELECT'
  })
  return editable ?? panel
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
  headerContent,
  titleId = 'terminal-modal-title',
  children,
  footer,
  size = 'md',
  zIndex = 640,
  closeOnEscape = true,
  closeOnBackdrop = false,
  panelVariant = 'default',
  bodyLayout = 'default',
  active = true,
}) => {
  const { t } = useT()
  const rootRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const visible = open && active

  useEffect(() => {
    if (!visible) return
    const raf = requestAnimationFrame(() => {
      const panel = panelRef.current
      if (!panel) return
      firstFocusTarget(panel).focus()
    })
    return () => cancelAnimationFrame(raf)
  }, [visible])

  useEffect(() => {
    if (!visible || !closeOnEscape) return
    const onKey = (e: KeyboardEvent): void => {
      if (e.key !== 'Escape') return
      const root = rootRef.current
      if (!root || !isTopmostModalRoot(root)) return
      e.preventDefault()
      e.stopPropagation()
      onClose()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [visible, closeOnEscape, onClose])

  useEffect(() => {
    if (!visible) return
    const onKey = (e: KeyboardEvent): void => {
      if (e.key !== 'Tab' || !panelRef.current) return
      const root = rootRef.current
      if (!root || !isTopmostModalRoot(root)) return
      const focusable = panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
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
  }, [visible])

  if (!visible) return null

  const hasRichHeader = headerContent != null && headerContent !== false
  const hasTitle = title != null && title !== ''
  const labelledBy = hasRichHeader || hasTitle ? titleId : undefined

  const bodyClass = [
    'terminal-modal-body',
    bodyLayout !== 'default' ? `terminal-modal-body--${bodyLayout}` : '',
  ].filter(Boolean).join(' ')

  const closeFromTraffic = (event: React.MouseEvent | React.PointerEvent): void => {
    if ('button' in event && event.button !== 0) return
    event.preventDefault()
    event.stopPropagation()
    onClose()
  }

  return createPortal(
    <div
      ref={rootRef}
      className="terminal-modal-root"
      style={{ '--modal-z': zIndex } as React.CSSProperties}
      role="presentation"
    >
      <div
        className="terminal-modal-scrim"
        aria-hidden="true"
        data-close-on-backdrop={closeOnBackdrop ? 'true' : undefined}
        onPointerDown={closeOnBackdrop ? (event) => {
          // pointerdown (no click): evita que el mouseup/click caiga en el plano.
          if (event.button !== 0) return
          const root = rootRef.current
          if (root && !isTopmostModalRoot(root)) return
          event.preventDefault()
          event.stopPropagation()
          onClose()
        } : undefined}
      />
      <div
        ref={panelRef}
        className={[
          'terminal-modal-panel',
          `terminal-modal-panel--${size}`,
          panelVariant !== 'default' ? `terminal-modal-panel--${panelVariant}` : '',
        ].filter(Boolean).join(' ')}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        tabIndex={-1}
        onClick={e => e.stopPropagation()}
        onPointerDown={e => e.stopPropagation()}
      >
        <header className="terminal-modal-header">
          <div className="terminal-modal-titlebar">
            <div
              className="terminal-modal-traffic"
              role="group"
              aria-label={t('ui.closeAriaLabel')}
            >
              <button
                type="button"
                className="terminal-modal-traffic-btn terminal-modal-traffic-btn--close"
                onPointerDown={closeFromTraffic}
                onClick={closeFromTraffic}
                aria-label={t('ui.closeAriaLabel')}
              />
              <button
                type="button"
                className="terminal-modal-traffic-btn terminal-modal-traffic-btn--min"
                disabled
                tabIndex={-1}
                aria-hidden="true"
              />
              <button
                type="button"
                className="terminal-modal-traffic-btn terminal-modal-traffic-btn--zoom"
                disabled
                tabIndex={-1}
                aria-hidden="true"
              />
            </div>
            {!hasRichHeader && hasTitle ? (
              <h2 className="terminal-modal-title" id={titleId}>{title}</h2>
            ) : null}
          </div>
          {hasRichHeader ? (
            <div className="terminal-modal-header-content" id={titleId}>
              {headerContent}
            </div>
          ) : null}
        </header>
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
