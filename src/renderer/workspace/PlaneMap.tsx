import React, { useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { AgentCliProvider, PaneKind, PaneWindowState } from '@shared/tabSession'
import {
  computePlaneMiniLetterboxSize,
  computeStandardPaneWindowGeometry,
  PLANE_MINI_WINDOW_HEIGHT,
  PLANE_MINI_WINDOW_WIDTH,
  type PaneWindowGeometry,
} from '@shared/paneWindows'
import { PlaneContextPool, type PlaneContextPoolItem } from './PlaneContextPool'
import { PlanePaneWindow, type PlaneAgentContextChip } from './PlanePaneWindow'
import './PlaneMap.css'

export type { PlaneAgentContextChip as PlaneMapAgentContextChip }

const SLOT_PAD_X = 28
const SLOT_PAD_Y = 72
/** Separación vertical entre minis (terminales y agentes). */
const SLOT_GAP = 10

/** Columna 3D: borde hacia el centro más lejos/pequeño. */
const COLUMN_TILT_DEG = 15
const COLUMN_PERSPECTIVE_PX = 1200

export interface PlaneMapEntity {
  paneId: string
  kind: PaneKind
  title: string
  busy: boolean
  provider?: AgentCliProvider
  snippet?: string
  contexts?: PlaneAgentContextChip[]
  autoImproveContexts?: boolean
  window: PaneWindowState
}

export interface PlaneMapProps {
  emptyTitle: string
  emptyHint: string
  idleAgentLabel: string
  contextPoolTitle: string
  contextPoolConfigureLabel: string
  tabContexts: PlaneContextPoolItem[]
  entities: PlaneMapEntity[]
  activePaneId: string
  configLabel: string
  deleteLabel: string
  maximizeLabel: string
  restoreLabel: string
  closeWindowLabel: string
  renderPane: (paneId: string) => React.ReactNode
  onExpandEntity: (paneId: string) => void
  onCloseWindow: (paneId: string) => void
  onFocusWindow: (paneId: string) => void
  onToggleFullscreen: (paneId: string) => void
  onMinimizeAllWindows?: () => void
  onConfigureContexts: () => void
  onOpenConfig: (paneId: string) => void
  onDeletePane: (paneId: string) => void
}

/** Ranura de terminal (celda). El footprint visual letterbox puede ser más bajo. */
function terminalSlotCell(): { width: number; height: number } {
  return { width: PLANE_MINI_WINDOW_WIDTH, height: PLANE_MINI_WINDOW_HEIGHT }
}

/** Ranuras fijas por orden estable de paneIds (abrir no reordena a las demás). */
function buildSlotOrigins(
  entities: PlaneMapEntity[],
  viewport: { width: number; height: number },
  openGeometry: PaneWindowGeometry,
): Record<string, PaneWindowGeometry> {
  const vw = Math.max(viewport.width, 320)
  const origins: Record<string, PaneWindowGeometry> = {}
  const terminals = entities.filter(entity => entity.kind !== 'agent')
  const agents = entities.filter(entity => entity.kind === 'agent')
  const cell = terminalSlotCell()
  const stride = cell.height + SLOT_GAP
  // Contenedor agente = footprint visual de la terminal (letterbox), no la celda entera.
  const agentBox = computePlaneMiniLetterboxSize(openGeometry, cell.width, cell.height)

  terminals.forEach((entity, index) => {
    origins[entity.paneId] = {
      x: SLOT_PAD_X,
      y: SLOT_PAD_Y + index * stride,
      width: cell.width,
      height: cell.height,
    }
  })
  agents.forEach((entity, index) => {
    const cellX = Math.max(SLOT_PAD_X, vw - SLOT_PAD_X - cell.width)
    const cellY = SLOT_PAD_Y + index * stride
    origins[entity.paneId] = {
      x: cellX + (cell.width - agentBox.width) / 2,
      y: cellY + (cell.height - agentBox.height) / 2,
      width: agentBox.width,
      height: agentBox.height,
    }
  })
  return origins
}

export const PlaneMap: React.FC<PlaneMapProps> = ({
  emptyTitle,
  emptyHint,
  idleAgentLabel,
  contextPoolTitle,
  contextPoolConfigureLabel,
  tabContexts,
  entities,
  activePaneId,
  configLabel,
  deleteLabel,
  maximizeLabel,
  restoreLabel,
  closeWindowLabel,
  renderPane,
  onExpandEntity,
  onCloseWindow,
  onFocusWindow,
  onToggleFullscreen,
  onMinimizeAllWindows,
  onConfigureContexts,
  onOpenConfig,
  onDeletePane,
}) => {
  const mapRef = useRef<HTMLDivElement>(null)
  const [viewport, setViewport] = useState({ width: 0, height: 0 })

  useLayoutEffect(() => {
    const el = mapRef.current
    if (!el) return
    const measure = (): void => {
      const width = el.clientWidth
      const height = el.clientHeight
      if (width <= 0 || height <= 0) return
      setViewport(prev => (
        prev.width === width && prev.height === height ? prev : { width, height }
      ))
    }
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const openGeometry = useMemo(
    () => computeStandardPaneWindowGeometry(
      viewport.width > 0 && viewport.height > 0
        ? viewport
        : { width: 960, height: 640 },
    ),
    [viewport],
  )

  const slotOrigins = useMemo(
    () => buildSlotOrigins(
      entities,
      viewport.width > 0 ? viewport : { width: 960, height: 640 },
      openGeometry,
    ),
    [entities, viewport, openGeometry],
  )

  // Orden DOM estable por paneId: si reordenamos al abrir, React remonta y cancela el morph.
  const terminals = useMemo(
    () => entities
      .filter(entity => entity.kind !== 'agent')
      .sort((a, b) => a.paneId.localeCompare(b.paneId)),
    [entities],
  )
  const agents = useMemo(
    () => entities
      .filter(entity => entity.kind === 'agent')
      .sort((a, b) => a.paneId.localeCompare(b.paneId)),
    [entities],
  )

  const anyFullscreen = entities.some(
    entity => entity.window.open && entity.window.fullscreen,
  )
  const terminalOpen = terminals.some(entity => entity.window.open)
  const agentOpen = agents.some(entity => entity.window.open)

  // 3D en el wrapper de columna (no clip-path 2D). Al abrir, vuelve a plano.
  const terminalsColumnTransform = `perspective(${COLUMN_PERSPECTIVE_PX}px) rotateY(${
    terminalOpen ? 0 : COLUMN_TILT_DEG
  }deg)`
  const agentsColumnTransform = `perspective(${COLUMN_PERSPECTIVE_PX}px) rotateY(${
    agentOpen ? 0 : -COLUMN_TILT_DEG
  }deg)`

  const renderEntity = (entity: PlaneMapEntity): React.ReactNode => {
    const slot = slotOrigins[entity.paneId] ?? {
      x: SLOT_PAD_X,
      y: SLOT_PAD_Y,
      width: entity.kind === 'agent'
        ? computePlaneMiniLetterboxSize(openGeometry).width
        : PLANE_MINI_WINDOW_WIDTH,
      height: entity.kind === 'agent'
        ? computePlaneMiniLetterboxSize(openGeometry).height
        : PLANE_MINI_WINDOW_HEIGHT,
    }
    const reserved = entity.window.open
    return (
      <React.Fragment key={entity.paneId}>
        {reserved ? (
          <div
            className="plane-map__slot-reserve"
            style={{
              left: slot.x,
              top: slot.y,
              width: slot.width,
              height: slot.height,
            }}
            aria-hidden="true"
          />
        ) : null}
        <PlanePaneWindow
          paneId={entity.paneId}
          kind={entity.kind}
          title={entity.title}
          busy={entity.busy}
          provider={entity.provider}
          snippet={entity.snippet}
          idleLabel={idleAgentLabel}
          window={entity.window}
          openGeometry={openGeometry}
          miniOrigin={slot}
          activePaneId={activePaneId}
          contexts={entity.contexts}
          configLabel={configLabel}
          deleteLabel={deleteLabel}
          maximizeLabel={maximizeLabel}
          restoreLabel={restoreLabel}
          closeWindowLabel={closeWindowLabel}
          onExpand={() => onExpandEntity(entity.paneId)}
          onClose={() => onCloseWindow(entity.paneId)}
          onFocus={() => onFocusWindow(entity.paneId)}
          onToggleFullscreen={() => onToggleFullscreen(entity.paneId)}
          onOpenConfig={() => onOpenConfig(entity.paneId)}
          onDelete={() => onDeletePane(entity.paneId)}
        >
          {renderPane(entity.paneId)}
        </PlanePaneWindow>
      </React.Fragment>
    )
  }

  return (
    <div ref={mapRef} className={[
      'plane-map',
      (terminalOpen || agentOpen) ? 'plane-map--elevated' : '',
    ].filter(Boolean).join(' ')}>
      <div className="plane-map__atmosphere" aria-hidden="true" />
      <div className="plane-map__grid" aria-hidden="true" />
      {(terminalOpen || agentOpen) ? (
        <div
          className="plane-map__dismiss"
          aria-hidden="true"
          onPointerDown={event => {
            if (event.button !== 0) return
            event.preventDefault()
            onMinimizeAllWindows?.()
          }}
        />
      ) : null}

      {entities.length === 0 ? (
        <div className="plane-map__empty">
          <strong>{emptyTitle}</strong>
          <p>{emptyHint}</p>
        </div>
      ) : (
        <div className="plane-map__stage">
          {terminals.length > 0 ? (
            <div
              className={[
                'plane-map__column',
                'plane-map__column--terminals',
                !terminalOpen ? 'plane-map__column--tilt' : '',
                terminalOpen ? 'plane-map__column--front' : '',
              ].filter(Boolean).join(' ')}
              style={{ transform: terminalsColumnTransform }}
            >
              {terminals.map(renderEntity)}
            </div>
          ) : null}
          {agents.length > 0 ? (
            <div
              className={[
                'plane-map__column',
                'plane-map__column--agents',
                !agentOpen ? 'plane-map__column--tilt' : '',
                agentOpen ? 'plane-map__column--front' : '',
              ].filter(Boolean).join(' ')}
              style={{ transform: agentsColumnTransform }}
            >
              {agents.map(renderEntity)}
            </div>
          ) : null}
        </div>
      )}

      {!anyFullscreen && (
        <PlaneContextPool
          title={contextPoolTitle}
          configureLabel={contextPoolConfigureLabel}
          contexts={tabContexts}
          onConfigure={onConfigureContexts}
        />
      )}
    </div>
  )
}
