import React, { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { AgentCliProvider, PaneKind, PaneWindowState } from '@shared/tabSession'
import {
  computePlaneMiniSlotCell,
  computePlaneMiniSlotPadX,
  computeStandardPaneWindowGeometry,
  estimatePlaneAgentMiniHeight,
  PLANE_MINI_SLOT_GAP,
  PLANE_MINI_SLOT_PAD_X,
  PLANE_MINI_SLOT_PAD_Y,
  PLANE_MINI_WINDOW_HEIGHT,
  PLANE_MINI_WINDOW_WIDTH,
  type PaneWindowGeometry,
} from '@shared/paneWindows'
import { PlanePaneWindow, type PlaneAgentContextChip } from './PlanePaneWindow'
import './PlaneMap.css'

export type { PlaneAgentContextChip as PlaneMapAgentContextChip }

/** Columna 3D: borde hacia el centro más lejos/pequeño. */
const COLUMN_TILT_DEG = 10
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
  /** Color de acento del agente en el plano. */
  color?: string
  /** Basename de la carpeta actual (terminales). */
  folderName?: string
  /** Path completo del cwd (tooltip del badge). */
  folderPath?: string
  window: PaneWindowState
}

export interface PlaneMapProps {
  emptyTitle: string
  emptyHint: string
  idleAgentLabel: string
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
  onOpenConfig: (paneId: string) => void
  /** Mini agente: clic en la card (o sus contextos) abre/cambia el chat. */
  onOpenChat: (paneId: string) => void
  onDeletePane: (paneId: string) => void
  /** Drop de contexto del pool sobre un agente. */
  onAssignContext?: (paneId: string, contextId: string) => void
}

/** Ranuras: terminales a altura de celda; agentes apilados a altura medida/estimada. */
function buildSlotOrigins(
  entities: PlaneMapEntity[],
  viewport: { width: number; height: number },
  agentHeights: Record<string, number>,
): Record<string, PaneWindowGeometry> {
  const vw = Math.max(viewport.width, 320)
  const origins: Record<string, PaneWindowGeometry> = {}
  const terminals = entities.filter(entity => entity.kind !== 'agent')
  const agents = entities.filter(entity => entity.kind === 'agent')
  const columnCount = Math.max(terminals.length, agents.length, 1)
  const cell = computePlaneMiniSlotCell(viewport, columnCount)
  const padX = computePlaneMiniSlotPadX(viewport, columnCount)
  const stride = cell.height + PLANE_MINI_SLOT_GAP

  terminals.forEach((entity, index) => {
    origins[entity.paneId] = {
      x: padX,
      y: PLANE_MINI_SLOT_PAD_Y + index * stride,
      width: cell.width,
      height: cell.height,
    }
  })

  let agentY = PLANE_MINI_SLOT_PAD_Y
  const agentX = Math.max(padX, vw - padX - cell.width)
  agents.forEach(entity => {
    const measured = agentHeights[entity.paneId]
    const height = measured && measured > 0
      ? measured
      : estimatePlaneAgentMiniHeight(entity.contexts?.length ?? 0)
    origins[entity.paneId] = {
      x: agentX,
      y: agentY,
      width: cell.width,
      height,
    }
    agentY += height + PLANE_MINI_SLOT_GAP
  })
  return origins
}

export const PlaneMap: React.FC<PlaneMapProps> = ({
  emptyTitle,
  emptyHint,
  idleAgentLabel,
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
  onOpenConfig,
  onOpenChat,
  onDeletePane,
  onAssignContext,
}) => {
  const mapRef = useRef<HTMLDivElement>(null)
  const [viewport, setViewport] = useState({ width: 0, height: 0 })
  const [agentHeights, setAgentHeights] = useState<Record<string, number>>({})

  const handleAgentMiniHeight = useCallback((paneId: string, height: number) => {
    setAgentHeights(prev => (prev[paneId] === height ? prev : { ...prev, [paneId]: height }))
  }, [])

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

  // Limpia alturas de agentes eliminados.
  useLayoutEffect(() => {
    const agentIds = new Set(
      entities.filter(entity => entity.kind === 'agent').map(entity => entity.paneId),
    )
    setAgentHeights(prev => {
      let changed = false
      const next: Record<string, number> = {}
      for (const [id, height] of Object.entries(prev)) {
        if (agentIds.has(id)) next[id] = height
        else changed = true
      }
      return changed ? next : prev
    })
  }, [entities])

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
      agentHeights,
    ),
    [entities, viewport, agentHeights],
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

  const terminalOpen = terminals.some(entity => entity.window.open)
  const agentOpen = agents.some(entity => entity.window.open)
  const anyWindowOpen = terminalOpen || agentOpen

  // Ambas columnas planas al instante con ventana abierta (morph / z-index 2D).
  // Sin transform/will-change en elevated: el full compite en el stage.
  const terminalsColumnTransform = anyWindowOpen
    ? undefined
    : `perspective(${COLUMN_PERSPECTIVE_PX}px) rotateY(${COLUMN_TILT_DEG}deg)`
  const agentsColumnTransform = anyWindowOpen
    ? undefined
    : `perspective(${COLUMN_PERSPECTIVE_PX}px) rotateY(${-COLUMN_TILT_DEG}deg)`

  const renderEntity = (entity: PlaneMapEntity): React.ReactNode => {
    const slot = slotOrigins[entity.paneId] ?? {
      x: PLANE_MINI_SLOT_PAD_X,
      y: PLANE_MINI_SLOT_PAD_Y,
      width: PLANE_MINI_WINDOW_WIDTH,
      height: PLANE_MINI_WINDOW_HEIGHT,
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
          folderName={entity.folderName}
          folderPath={entity.folderPath}
          onExpand={() => onExpandEntity(entity.paneId)}
          onClose={() => onCloseWindow(entity.paneId)}
          onFocus={() => onFocusWindow(entity.paneId)}
          onToggleFullscreen={() => onToggleFullscreen(entity.paneId)}
          onOpenConfig={() => onOpenConfig(entity.paneId)}
          onOpenChat={() => onOpenChat(entity.paneId)}
          onDelete={() => onDeletePane(entity.paneId)}
          onDropContext={entity.kind === 'agent' && onAssignContext
            ? contextId => onAssignContext(entity.paneId, contextId)
            : undefined}
          onMiniContentHeightChange={entity.kind === 'agent'
            ? height => handleAgentMiniHeight(entity.paneId, height)
            : undefined}
        >
          {renderPane(entity.paneId)}
        </PlanePaneWindow>
      </React.Fragment>
    )
  }

  return (
    <div ref={mapRef} className={[
      'plane-map',
      anyWindowOpen ? 'plane-map--elevated' : '',
    ].filter(Boolean).join(' ')}>
      <div className="plane-map__atmosphere" aria-hidden="true" />
      <div className="plane-map__grid" aria-hidden="true" />
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
                !anyWindowOpen ? 'plane-map__column--tilt' : '',
                terminalOpen ? 'plane-map__column--front' : '',
              ].filter(Boolean).join(' ')}
              style={terminalsColumnTransform
                ? { transform: terminalsColumnTransform }
                : undefined}
            >
              {terminals.map(renderEntity)}
            </div>
          ) : null}
          {agents.length > 0 ? (
            <div
              className={[
                'plane-map__column',
                'plane-map__column--agents',
                !anyWindowOpen ? 'plane-map__column--tilt' : '',
                agentOpen ? 'plane-map__column--front' : '',
              ].filter(Boolean).join(' ')}
              style={agentsColumnTransform
                ? { transform: agentsColumnTransform }
                : undefined}
            >
              {agents.map(renderEntity)}
            </div>
          ) : null}
        </div>
      )}

    </div>
  )
}
