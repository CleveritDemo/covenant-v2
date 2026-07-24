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
import type { PaneReorderKind } from '../arrayReorder'
import { PlanePaneWindow, type PlaneAgentContextChip } from './PlanePaneWindow'
import { usePlaneColumnReorder } from './planeColumnReorder'
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
  coordination?: 'none' | 'orchestrator'
  snippet?: string
  /** Slug del agente en catálogo (drag de results). */
  agentId?: string
  /** Ids asignados en catálogo (fuente de verdad para selección en UI). */
  contextIds?: string[]
  contexts?: PlaneAgentContextChip[]
  autoImproveContexts?: boolean
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
  /** Agente con chat abierto en el plano (selección estática, no busy). */
  chatActiveAgentId?: string | null
  configLabel: string
  deleteLabel: string
  maximizeLabel: string
  restoreLabel: string
  closeWindowLabel: string
  reorderAriaLabel?: string
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
  /** Persiste el nuevo orden de una columna (kind). */
  onReorderPanes?: (kind: PaneReorderKind, orderedPaneIds: string[]) => void
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

function orderEntitiesByIds(
  entities: PlaneMapEntity[],
  orderedIds: readonly string[],
): PlaneMapEntity[] {
  const byId = new Map(entities.map(entity => [entity.paneId, entity]))
  return orderedIds
    .map(id => byId.get(id))
    .filter((entity): entity is PlaneMapEntity => Boolean(entity))
}

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() => (
    typeof window !== 'undefined'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  ))
  useLayoutEffect(() => {
    if (typeof window === 'undefined') return
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const onChange = (): void => setReduced(mq.matches)
    onChange()
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return reduced
}

export const PlaneMap: React.FC<PlaneMapProps> = ({
  emptyTitle,
  emptyHint,
  idleAgentLabel,
  entities,
  activePaneId,
  chatActiveAgentId = null,
  configLabel,
  deleteLabel,
  maximizeLabel,
  restoreLabel,
  closeWindowLabel,
  reorderAriaLabel,
  renderPane,
  onExpandEntity,
  onCloseWindow,
  onFocusWindow,
  onToggleFullscreen,
  onOpenConfig,
  onOpenChat,
  onDeletePane,
  onAssignContext,
  onReorderPanes,
}) => {
  const mapRef = useRef<HTMLDivElement>(null)
  const [viewport, setViewport] = useState({ width: 0, height: 0 })
  const [agentHeights, setAgentHeights] = useState<Record<string, number>>({})
  const reducedMotion = usePrefersReducedMotion()

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

  // Orden visual de columna = orden en entities (paneIds), no localeCompare.
  const terminalsInOrder = useMemo(
    () => entities.filter(entity => entity.kind !== 'agent'),
    [entities],
  )
  const agentsInOrder = useMemo(
    () => entities.filter(entity => entity.kind === 'agent'),
    [entities],
  )

  const terminalIds = useMemo(
    () => terminalsInOrder.map(entity => entity.paneId),
    [terminalsInOrder],
  )
  const agentIds = useMemo(
    () => agentsInOrder.map(entity => entity.paneId),
    [agentsInOrder],
  )

  const terminalOpen = terminalsInOrder.some(entity => entity.window.open)
  const agentOpen = agentsInOrder.some(entity => entity.window.open)
  const anyWindowOpen = terminalOpen || agentOpen
  const reorderEnabled = Boolean(onReorderPanes) && !anyWindowOpen

  const baselineSlots = useMemo(
    () => buildSlotOrigins(
      entities,
      viewport.width > 0 ? viewport : { width: 960, height: 640 },
      agentHeights,
    ),
    [entities, viewport, agentHeights],
  )

  const terminalSlots = useMemo(() => {
    const next: Record<string, PaneWindowGeometry> = {}
    for (const id of terminalIds) {
      const slot = baselineSlots[id]
      if (slot) next[id] = slot
    }
    return next
  }, [baselineSlots, terminalIds])

  const agentSlots = useMemo(() => {
    const next: Record<string, PaneWindowGeometry> = {}
    for (const id of agentIds) {
      const slot = baselineSlots[id]
      if (slot) next[id] = slot
    }
    return next
  }, [agentIds, baselineSlots])

  const commitTerminals = useCallback((ordered: string[]) => {
    onReorderPanes?.('terminal', ordered)
  }, [onReorderPanes])

  const commitAgents = useCallback((ordered: string[]) => {
    onReorderPanes?.('agent', ordered)
  }, [onReorderPanes])

  const activateTerminal = useCallback((paneId: string) => {
    onExpandEntity(paneId)
  }, [onExpandEntity])

  const activateAgent = useCallback((paneId: string) => {
    onOpenChat(paneId)
  }, [onOpenChat])

  const terminalReorder = usePlaneColumnReorder({
    enabled: reorderEnabled && terminalIds.length >= 2,
    kind: 'terminal',
    orderedIds: terminalIds,
    slots: terminalSlots,
    onCommit: commitTerminals,
    onActivate: activateTerminal,
    reducedMotion,
  })

  const agentReorder = usePlaneColumnReorder({
    enabled: reorderEnabled && agentIds.length >= 2,
    kind: 'agent',
    orderedIds: agentIds,
    slots: agentSlots,
    onCommit: commitAgents,
    onActivate: activateAgent,
    reducedMotion,
  })

  const reorderActive = terminalReorder.editing
    || agentReorder.editing
    || Boolean(terminalReorder.draggingId)
    || Boolean(agentReorder.draggingId)

  // Click en el vacío cancela el modo edición.
  const cancelTerminalReorder = terminalReorder.cancel
  const cancelAgentReorder = agentReorder.cancel
  useLayoutEffect(() => {
    if (!reorderActive) return
    const onPointerDown = (event: PointerEvent): void => {
      const target = event.target
      if (!(target instanceof Node)) return
      if (mapRef.current?.contains(target)) {
        const el = target instanceof Element ? target : target.parentElement
        if (el?.closest?.('.pane-window')) return
      }
      cancelTerminalReorder()
      cancelAgentReorder()
    }
    window.addEventListener('pointerdown', onPointerDown, true)
    return () => window.removeEventListener('pointerdown', onPointerDown, true)
  }, [cancelAgentReorder, cancelTerminalReorder, reorderActive])

  /**
   * Durante drag: layout temporal según previewIds (hueco del dragged + resto).
   * El hit-test del hook usa slots/ids congelados del gesto (no este layout).
   */
  const layoutEntities = useMemo(() => {
    const terminals = terminalReorder.previewIds
      ? orderEntitiesByIds(terminalsInOrder, terminalReorder.previewIds)
      : terminalsInOrder
    const agents = agentReorder.previewIds
      ? orderEntitiesByIds(agentsInOrder, agentReorder.previewIds)
      : agentsInOrder
    return [...terminals, ...agents]
  }, [
    agentReorder.previewIds,
    agentsInOrder,
    terminalReorder.previewIds,
    terminalsInOrder,
  ])

  const slotOrigins = useMemo(
    () => buildSlotOrigins(
      layoutEntities,
      viewport.width > 0 ? viewport : { width: 960, height: 640 },
      agentHeights,
    ),
    [agentHeights, layoutEntities, viewport],
  )

  // Orden DOM estable por paneId: si reordenamos al abrir, React remonta y cancela el morph.
  const terminalsDom = useMemo(
    () => [...terminalsInOrder].sort((a, b) => a.paneId.localeCompare(b.paneId)),
    [terminalsInOrder],
  )
  const agentsDom = useMemo(
    () => [...agentsInOrder].sort((a, b) => a.paneId.localeCompare(b.paneId)),
    [agentsInOrder],
  )

  // Aplanar tilt mientras se reordena para alinear pointer ↔ left/top.
  const flattenColumns = anyWindowOpen || reorderActive
  const terminalsColumnTransform = flattenColumns
    ? undefined
    : `perspective(${COLUMN_PERSPECTIVE_PX}px) rotateY(${COLUMN_TILT_DEG}deg)`
  const agentsColumnTransform = flattenColumns
    ? undefined
    : `perspective(${COLUMN_PERSPECTIVE_PX}px) rotateY(${-COLUMN_TILT_DEG}deg)`

  const renderEntity = (
    entity: PlaneMapEntity,
    column: 'terminal' | 'agent',
    indexInColumn: number,
  ): React.ReactNode => {
    const reorder = column === 'terminal' ? terminalReorder : agentReorder
    const slot = slotOrigins[entity.paneId] ?? {
      x: PLANE_MINI_SLOT_PAD_X,
      y: PLANE_MINI_SLOT_PAD_Y,
      width: PLANE_MINI_WINDOW_WIDTH,
      height: PLANE_MINI_WINDOW_HEIGHT,
    }
    const reserved = entity.window.open
    const isDragging = reorder.draggingId === entity.paneId
    const dragPos = isDragging ? reorder.dragPosition : null
    const columnEnabled = reorderEnabled && (
      column === 'terminal' ? terminalIds.length >= 2 : agentIds.length >= 2
    )

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
          coordination={entity.coordination}
          snippet={entity.snippet}
          idleLabel={idleAgentLabel}
          window={entity.window}
          openGeometry={openGeometry}
          miniOrigin={slot}
          activePaneId={activePaneId}
          chatActive={entity.kind === 'agent' && entity.paneId === chatActiveAgentId}
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
          reorderEnabled={columnEnabled}
          reorderState={reorder.getVisualState(entity.paneId)}
          reorderJiggleDelayMs={(indexInColumn % 5) * 40}
          slotMotion={reorderActive}
          dragPosition={dragPos}
          onReorderPointerDown={event => {
            if (column === 'terminal') agentReorder.cancel()
            else terminalReorder.cancel()
            reorder.onCardPointerDown(entity.paneId, event)
          }}
          onReorderHandlePointerDown={entity.kind === 'agent'
            ? event => {
              if (column === 'terminal') agentReorder.cancel()
              else terminalReorder.cancel()
              reorder.onHandlePointerDown(entity.paneId, event)
            }
            : undefined}
          agentId={entity.agentId}
        >
          {renderPane(entity.paneId)}
        </PlanePaneWindow>
      </React.Fragment>
    )
  }

  return (
    <div
      ref={mapRef}
      className={[
        'plane-map',
        anyWindowOpen ? 'plane-map--elevated' : '',
        reorderActive ? 'plane-map--reordering' : '',
      ].filter(Boolean).join(' ')}
      aria-label={reorderActive ? reorderAriaLabel : undefined}
    >
      <div className="plane-map__atmosphere" aria-hidden="true" />
      <div className="plane-map__grid" aria-hidden="true" />
      {entities.length === 0 ? (
        <div className="plane-map__empty">
          <strong>{emptyTitle}</strong>
          <p>{emptyHint}</p>
        </div>
      ) : (
        <div className="plane-map__stage">
          {terminalsDom.length > 0 ? (
            <div
              className={[
                'plane-map__column',
                'plane-map__column--terminals',
                !flattenColumns ? 'plane-map__column--tilt' : '',
                terminalOpen ? 'plane-map__column--front' : '',
              ].filter(Boolean).join(' ')}
              style={terminalsColumnTransform
                ? { transform: terminalsColumnTransform }
                : undefined}
            >
              {terminalsDom.map((entity, index) => renderEntity(entity, 'terminal', index))}
            </div>
          ) : null}
          {agentsDom.length > 0 ? (
            <div
              className={[
                'plane-map__column',
                'plane-map__column--agents',
                !flattenColumns ? 'plane-map__column--tilt' : '',
                agentOpen ? 'plane-map__column--front' : '',
              ].filter(Boolean).join(' ')}
              style={agentsColumnTransform
                ? { transform: agentsColumnTransform }
                : undefined}
            >
              {agentsDom.map((entity, index) => renderEntity(entity, 'agent', index))}
            </div>
          ) : null}
        </div>
      )}

    </div>
  )
}
