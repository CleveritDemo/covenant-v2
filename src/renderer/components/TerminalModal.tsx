import React, { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useT } from '@i18n/useT'
import { isReduceMotionActive } from '../reduceMotion'
import { WindowControls } from './ui/WindowControls'
import './TerminalModal.css'

export type TerminalModalSize = 'sm' | 'md' | 'lg' | 'xl' | 'xxl'
/** Variante del panel para casos de uso específicos (sin className en props). */
export type TerminalModalPanelVariant = 'default' | 'theme-picker'
/** Layout del cuerpo del modal. */
export type TerminalModalBodyLayout = 'default' | 'spacious' | 'flush'

export interface TerminalModalPosition {
  x: number
  y: number
}

const MOVABLE_CLAMP_PADDING = 8

const FALLBACK_PANEL_WIDTH: Record<TerminalModalSize, number> = {
  sm: 400,
  md: 520,
  lg: 640,
  xl: 900,
  xxl: 1100,
}

const FALLBACK_PANEL_HEIGHT = 200

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
  /** Panel arrastrable por la titlebar; portal y posición absoluta dentro del contenedor. */
  movable?: boolean
  /** Solo con movable; si falta, se centra en boundsRef. */
  initialPosition?: TerminalModalPosition
  /** Rect de clamp (clientWidth/Height). */
  boundsRef?: React.RefObject<HTMLElement | null>
  /** Con movable, portal aquí en vez de document.body. */
  portalContainerRef?: React.RefObject<HTMLElement | null>
  /** Al soltar el drag. */
  onPositionChange?: (pos: TerminalModalPosition) => void
  /** Origen de la animación de entrada (mismo espacio que initialPosition). */
  enterOrigin?: { x: number; y: number }
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

function getBoundsSize(
  boundsRef: React.RefObject<HTMLElement | null> | undefined,
  portalContainer: HTMLElement | null,
): { width: number; height: number } {
  const el = boundsRef?.current ?? portalContainer
  if (el) {
    return { width: el.clientWidth, height: el.clientHeight }
  }
  return { width: window.innerWidth, height: window.innerHeight }
}

function clampPanelPosition(
  x: number,
  y: number,
  panelWidth: number,
  panelHeight: number,
  boundsWidth: number,
  boundsHeight: number,
  padding = MOVABLE_CLAMP_PADDING,
): TerminalModalPosition {
  const maxX = Math.max(padding, boundsWidth - panelWidth - padding)
  const maxY = Math.max(padding, boundsHeight - panelHeight - padding)
  return {
    x: Math.max(padding, Math.min(maxX, x)),
    y: Math.max(padding, Math.min(maxY, y)),
  }
}

function firstFocusTarget(panel: HTMLElement): HTMLElement {
  // Preferir campos editables (Find/Settings/Commit); si no, el panel (no el 1.er botón).
  const nodes = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))
    .filter(el => !el.classList.contains('window-controls__btn'))
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
  movable = false,
  initialPosition,
  boundsRef,
  portalContainerRef,
  onPositionChange,
  enterOrigin,
}) => {
  const { t } = useT()
  const rootRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{
    pointerId: number
    startX: number
    startY: number
    originX: number
    originY: number
  } | null>(null)
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null)
  const positionRef = useRef<{ x: number; y: number } | null>(null)
  const [portalTarget, setPortalTarget] = useState<HTMLElement>(document.body)
  const visible = open && active

  positionRef.current = position

  useLayoutEffect(() => {
    if (!visible) return
    if (!movable) {
      setPortalTarget(document.body)
      return
    }
    const container = portalContainerRef?.current
    if (container) {
      setPortalTarget(container)
      return
    }
    const raf = requestAnimationFrame(() => {
      const next = portalContainerRef?.current
      if (next) setPortalTarget(next)
    })
    return () => cancelAnimationFrame(raf)
  }, [visible, movable, portalContainerRef])

  useEffect(() => {
    if (!visible) setPosition(null)
  }, [visible])

  useLayoutEffect(() => {
    if (!visible || !movable) return
    const panel = panelRef.current
    if (!panel) return
    const portalContainer = portalContainerRef?.current ?? null
    const bounds = getBoundsSize(boundsRef, portalContainer)
    const panelWidth = panel.offsetWidth || FALLBACK_PANEL_WIDTH[size]
    const panelHeight = panel.offsetHeight || FALLBACK_PANEL_HEIGHT
    const target = initialPosition ?? {
      x: (bounds.width - panelWidth) / 2,
      y: (bounds.height - panelHeight) / 2,
    }
    setPosition(clampPanelPosition(
      target.x,
      target.y,
      panelWidth,
      panelHeight,
      bounds.width,
      bounds.height,
    ))
  }, [
    visible,
    movable,
    initialPosition?.x,
    initialPosition?.y,
    boundsRef,
    portalContainerRef,
    size,
  ])

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
      // Capas anidadas (p. ej. popup Aspecto) se registran después en capture;
      // si ya hay una abierta, no cerramos el modal — ellas consumen Escape.
      if (root.querySelector('[data-escape-layer]')) return
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

  const onTitlebarPointerDown = (event: React.PointerEvent<HTMLDivElement>): void => {
    if (!movable || event.button !== 0) return
    if ((event.target as HTMLElement).closest('.window-controls__btn')) return
    const currentPosition = positionRef.current
    if (!currentPosition) return
    event.preventDefault()
    event.stopPropagation()
    const titlebar = event.currentTarget
    const pointerId = event.pointerId
    try {
      titlebar.setPointerCapture(pointerId)
    } catch {
      // jsdom y algunos entornos de test no implementan pointer capture.
    }
    dragRef.current = {
      pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: currentPosition.x,
      originY: currentPosition.y,
    }

    const onMove = (moveEvent: PointerEvent): void => {
      const drag = dragRef.current
      if (!drag) return
      moveEvent.preventDefault()
      const panel = panelRef.current
      if (!panel) return
      const portalContainer = portalContainerRef?.current ?? null
      const bounds = getBoundsSize(boundsRef, portalContainer)
      const panelWidth = panel.offsetWidth || FALLBACK_PANEL_WIDTH[size]
      const panelHeight = panel.offsetHeight || FALLBACK_PANEL_HEIGHT
      const next = clampPanelPosition(
        drag.originX + (moveEvent.clientX - drag.startX),
        drag.originY + (moveEvent.clientY - drag.startY),
        panelWidth,
        panelHeight,
        bounds.width,
        bounds.height,
      )
      setPosition(next)
    }

    const onUp = (upEvent: PointerEvent): void => {
      const drag = dragRef.current
      if (!drag) return
      upEvent.preventDefault()
      dragRef.current = null
      try {
        if (titlebar.hasPointerCapture(upEvent.pointerId)) {
          titlebar.releasePointerCapture(upEvent.pointerId)
        }
      } catch {
        // noop
      }
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
      const panel = panelRef.current
      if (!panel) return
      const portalContainer = portalContainerRef?.current ?? null
      const bounds = getBoundsSize(boundsRef, portalContainer)
      const finalPos = clampPanelPosition(
        drag.originX + (upEvent.clientX - drag.startX),
        drag.originY + (upEvent.clientY - drag.startY),
        panel.offsetWidth || FALLBACK_PANEL_WIDTH[size],
        panel.offsetHeight || FALLBACK_PANEL_HEIGHT,
        bounds.width,
        bounds.height,
      )
      setPosition(finalPos)
      onPositionChange?.(finalPos)
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
  }

  const rootClass = movable
    ? 'terminal-modal-root terminal-modal-root--movable'
    : 'terminal-modal-root'

  const panelPositionStyle = movable && position
    ? ({ left: position.x, top: position.y } as React.CSSProperties)
    : undefined

  const useFromOriginEnter = Boolean(
    movable && position && enterOrigin && !isReduceMotionActive(),
  )
  const panelEnterStyle = useFromOriginEnter && enterOrigin && position
    ? ({
      ...panelPositionStyle,
      '--terminal-modal-enter-ox': `${enterOrigin.x - position.x}px`,
      '--terminal-modal-enter-oy': `${enterOrigin.y - position.y}px`,
    } as React.CSSProperties)
    : panelPositionStyle

  return createPortal(
    <div
      ref={rootRef}
      className={rootClass}
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
          movable ? 'terminal-modal-panel--movable' : '',
          useFromOriginEnter ? 'terminal-modal-panel--from-origin' : '',
        ].filter(Boolean).join(' ')}
        style={panelEnterStyle}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        tabIndex={-1}
        onClick={e => e.stopPropagation()}
        onPointerDown={e => e.stopPropagation()}
      >
        <header className="terminal-modal-header">
          <div
            className="terminal-modal-titlebar"
            onPointerDown={onTitlebarPointerDown}
          >
            <WindowControls
              closeLabel={t('ui.closeAriaLabel')}
              minimizeLabel=""
              zoomLabel=""
              onClose={() => onClose()}
              minimizeDisabled
              zoomDisabled
            />
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
        {children != null && children !== false ? (
          <div className={bodyClass}>
            {children}
          </div>
        ) : null}
        {footer != null && footer !== false && (
          <footer className="terminal-modal-footer">
            {footer}
          </footer>
        )}
      </div>
    </div>,
    portalTarget,
  )
}
