import React, { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { APP_OVERLAY_MODAL_Z } from '@shared/overlayZIndex'
import {
  brainstormSeatCellHeight,
  brainstormSeatTier,
  type BrainstormSeatTier,
} from '@shared/brainstormSeatCell'
import { Icon } from '../components/ui/Icon'
import { Tooltip } from '../components/ui/Tooltip'
import { PlaneComposerAurora } from './PlaneComposerAurora'
import { PlaneComposerAuroraParticles } from './PlaneComposerAuroraParticles'
import { PlaneMapSphericalGrid } from './PlaneMapSphericalGrid'
import './BrainstormOverlay.css'

export interface BrainstormOverlayProps {
  /** Tab inactiva: no montar (no tapar el plano de otro workspace). */
  active?: boolean
  ariaLabel: string
  closeLabel: string
  /** Cerrar es solo la vista: el runner sigue en main. */
  onClose: () => void
  /** Chips y acciones del chrome, antes del botón de cerrar. */
  chrome?: React.ReactNode
  /** Columna izquierda: lo que la sala usa (formato, material, cola). */
  /**
   * Hay un turno en marcha: enciende las mismas partículas que el piso del
   * plano usa mientras un agente trabaja. La sala es el mismo trabajo, así que
   * es la misma señal ambiental y no una nueva.
   */
  busy?: boolean
  left?: React.ReactNode
  /** Columna derecha: los asientos. */
  right?: React.ReactNode
  /** Cuántas tarjetas hay en la columna derecha: fija el alto de celda. */
  seatCount?: number
  /**
   * `setup` ensancha la columna izquierda: ahí van las once ceremonias y el
   * buscador de material, que no caben en la ranura de una mini. En vivo las
   * dos columnas miden lo mismo que las del plano de codificación.
   */
  variant?: 'setup' | 'live'
  /**
   * Capa por encima de las tres columnas: el pane de un asiento. Va aquí y no
   * en `children` porque cada columna es un contexto de apilado propio (`z-index:
   * 1` sobre el piso de partículas), así que un velo montado dentro del centro
   * solo tapaba el centro: los asientos y el borde de su columna seguían encima.
   */
  pane?: React.ReactNode
  children: React.ReactNode
}

/**
 * Caparazón de la sala sobre el plano: `absolute inset:0` dentro de
 * `.tab-agentic-plane`, igual que el mapa neuronal de la wiki. No es un tab ni
 * un modal — el plano sigue debajo y la barra de navegación arriba a la
 * izquierda queda por encima (z 675) porque es lo único que permite moverse.
 * Por eso la rejilla reserva una fila de gutter: ningún contenido puede caer
 * debajo de esa barra.
 *
 * La escala la ponen las dos columnas de minis, con la ranura del plano de
 * codificación: se aprietan hasta el mínimo y a partir de ahí scrollean.
 */
export const BrainstormOverlay: React.FC<BrainstormOverlayProps> = ({
  active = true,
  ariaLabel,
  closeLabel,
  onClose,
  chrome,
  busy = false,
  left,
  right,
  seatCount = 0,
  variant = 'live',
  pane,
  children,
}) => {
  const rootRef = useRef<HTMLDivElement>(null)
  const [cell, setCell] = useState(() => brainstormSeatCellHeight(800, seatCount || 1))

  // Escape cierra la vista — salvo que haya un modal portaled encima
  // (confirmaciones, pickers): ese Escape es del modal.
  useEffect(() => {
    if (!active) return
    const onKey = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') return
      if (document.querySelector('.terminal-modal-root')) return
      event.preventDefault()
      onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [active, onClose])

  // El alto de celda se mide sobre el plano real: la misma sala en una ventana
  // baja aprieta más y scrollea antes.
  useLayoutEffect(() => {
    if (!active) return
    const node = rootRef.current
    if (!node) return
    const measure = (): void => {
      setCell(brainstormSeatCellHeight(node.clientHeight, Math.max(1, seatCount)))
    }
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(measure)
    observer.observe(node)
    return () => observer.disconnect()
  }, [active, seatCount])

  if (!active) return null

  const tier: BrainstormSeatTier = brainstormSeatTier(cell)

  return (
    <div
      ref={rootRef}
      className={`brainstorm-overlay brainstorm-overlay--${variant}`}
      role="region"
      aria-label={ariaLabel}
      style={{
        zIndex: APP_OVERLAY_MODAL_Z,
        '--brainstorm-seat-cell': `${cell}px`,
      } as React.CSSProperties}
      data-seat-tier={tier}
    >
      {/* La sala reusa el piso del plano — rejilla debajo, partículas encima. */}
      <div className="brainstorm-overlay__floor" aria-hidden="true">
        <PlaneMapSphericalGrid />
        <PlaneComposerAuroraParticles active={busy} tabActive={active} />
      </div>
      {/* La cinta es del suelo de la sala, como en el plano es del plano y no del composer. */}
      <PlaneComposerAurora working={busy} />

      <header className="brainstorm-overlay__bar">
        {chrome}
        <Tooltip content={closeLabel}>
          <button
            type="button"
            className="brainstorm-overlay__icon"
            aria-label={closeLabel}
            onClick={onClose}
          >
            <Icon name="close" size={12} />
          </button>
        </Tooltip>
      </header>

      {left ? (
        <aside className="brainstorm-overlay__col brainstorm-overlay__col--left">
          {left}
        </aside>
      ) : null}

      <div className="brainstorm-overlay__center">{children}</div>

      {right ? (
        <aside className="brainstorm-overlay__col brainstorm-overlay__col--right">
          {right}
        </aside>
      ) : null}

      {pane}
    </div>
  )
}
