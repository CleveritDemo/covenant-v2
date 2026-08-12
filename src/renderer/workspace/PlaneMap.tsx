import React, { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { AgentCliProvider, PaneKind, PaneWindowState } from '@shared/tabSession'
import {
  clampPlaneColumnScroll,
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
import { PlaneMapBackdrop } from './PlaneMapBackdrop'
import { usePlaneColumnReorder } from './planeColumnReorder'
import { isReduceMotionActive } from '../reduceMotion'
import './PlaneMap.css'

export type { PlaneAgentContextChip as PlaneMapAgentContextChip }

/** Columna 3D: borde hacia el centro más lejos/pequeño. */
const COLUMN_TILT_DEG = 10
const COLUMN_PERSPECTIVE_PX = 1200

export interface PlaneMapEntity {
  paneId: string
  kind: PaneKind
  title: string
  /** Réplica temporal del experto: `R2`, `R3`… (del id `frontend-2`). */
  instanceTag?: string
  /** Experto base: réplicas suyas vivas ahora mismo. */
  replicaCount?: number
  monogram?: string
  busy: boolean
  /** Trabajo reservado/activo por una delegación del orquestador. */
  delegationWorkActive?: boolean
  provider?: AgentCliProvider
  coordination?: 'none' | 'orchestrator' | 'productOwner'
  snippet?: string
  /** Slug del agente en catálogo (drag de results). */
  agentId?: string
  /** Réplica temporal del turbo: no se sienta en una sala de brainstorm. */
  localOnly?: boolean
  /** Ids asignados en catálogo (fuente de verdad para selección en UI). */
  contextIds?: string[]
  contexts?: PlaneAgentContextChip[]
  autoImproveContexts?: boolean
  /** Nombre puesto a mano (terminales); sustituye la carpeta en la pastilla. */
  customTitle?: string
  /** Basename de la carpeta actual (terminales). */
  folderName?: string
  window: PaneWindowState
}

export interface PlaneMapProps {
  idleAgentLabel: string
  entities: PlaneMapEntity[]
  activePaneId: string
  /** Agente con chat abierto en el plano (selección estática, no busy). */
  chatActiveAgentId?: string | null
  /** Tab activa: oculta modales portaled del plano. */
  tabActive?: boolean
  /** Mesa de brainstorm abierta: las cards de agente se arrastran a ella. */
  seatDragEnabled?: boolean
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
  onRenamePane?: (paneId: string, title: string) => void
  /** Drop de contexto del pool sobre un agente. */
  onAssignContext?: (paneId: string, contextId: string) => void
  /** Clic en icono results del mini → vista previa del contexto. */
  onOpenResultsPreview?: (contextId: string) => void
  /** Persiste el nuevo orden de una columna (kind). */
  onReorderPanes?: (kind: PaneReorderKind, orderedPaneIds: string[]) => void
  /**
   * Primer layout estable del plano (viewport + alturas de agentes).
   * Solo dispara una vez; pensado para liberar el splash de arranque.
   */
  onFirstLayoutReady?: () => void
  /** Sin transición de ranura hasta que el splash pueda fundirse. */
  deferPositionMotion?: boolean
  /** Agente seleccionado en curso: partículas busy en el piso del mapa. */
  working?: boolean
}

export interface PlaneColumnScrollOffsets {
  terminal: number
  agent: number
}

const ZERO_SCROLL_OFFSETS: PlaneColumnScrollOffsets = { terminal: 0, agent: 0 }

interface PlaneSlotLayout {
  origins: Record<string, PaneWindowGeometry>
  /** Altura total de contenido por columna (sin clearance inferior). */
  contentHeights: PlaneColumnScrollOffsets
}

/**
 * Ranuras: terminales a altura de celda; agentes apilados a altura medida/estimada.
 * `scrollOffsets` desplaza cada columna hacia arriba (scroll virtual).
 */
export function buildSlotOrigins(
  entities: PlaneMapEntity[],
  viewport: { width: number; height: number },
  agentHeights: Record<string, number>,
  scrollOffsets: PlaneColumnScrollOffsets = ZERO_SCROLL_OFFSETS,
): PlaneSlotLayout {
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
      y: PLANE_MINI_SLOT_PAD_Y + index * stride - scrollOffsets.terminal,
      width: cell.width,
      height: cell.height,
    }
  })
  const terminalContentHeight = terminals.length > 0
    ? PLANE_MINI_SLOT_PAD_Y
      + terminals.length * cell.height
      + (terminals.length - 1) * PLANE_MINI_SLOT_GAP
    : 0

  let agentY = PLANE_MINI_SLOT_PAD_Y
  const agentX = Math.max(padX, vw - padX - cell.width)
  agents.forEach(entity => {
    const measured = agentHeights[entity.paneId]
    const height = measured && measured > 0
      ? measured
      : estimatePlaneAgentMiniHeight(entity.contexts?.length ?? 0)
    origins[entity.paneId] = {
      x: agentX,
      y: agentY - scrollOffsets.agent,
      width: cell.width,
      height,
    }
    agentY += height + PLANE_MINI_SLOT_GAP
  })
  return {
    origins,
    contentHeights: {
      terminal: terminalContentHeight,
      agent: agents.length > 0 ? agentY : 0,
    },
  }
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
  const [reduced, setReduced] = useState(() => isReduceMotionActive())
  useLayoutEffect(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return
    const sync = (): void => setReduced(isReduceMotionActive())
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    mq.addEventListener('change', sync)
    const observer = new MutationObserver(sync)
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-reduce-motion'],
    })
    sync()
    return () => {
      mq.removeEventListener('change', sync)
      observer.disconnect()
    }
  }, [])
  return reduced
}

export const PlaneMap: React.FC<PlaneMapProps> = ({
  idleAgentLabel,
  entities,
  activePaneId,
  chatActiveAgentId = null,
  tabActive = true,
  seatDragEnabled = false,
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
  onRenamePane,
  onAssignContext,
  onOpenResultsPreview,
  onReorderPanes,
  onFirstLayoutReady,
  deferPositionMotion = false,
  working = false,
}) => {
  const mapRef = useRef<HTMLDivElement>(null)
  const [viewport, setViewport] = useState({ width: 0, height: 0 })
  const [agentHeights, setAgentHeights] = useState<Record<string, number>>({})
  const [scrollOffsets, setScrollOffsets] = useState<PlaneColumnScrollOffsets>(ZERO_SCROLL_OFFSETS)
  const [wheelScrolling, setWheelScrolling] = useState(false)
  const wheelScrollingTimeoutRef = useRef<number | null>(null)
  const firstLayoutReadyRef = useRef(false)
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

  // Viewport medido + alturas reales de agentes → primer layout estable (splash).
  useLayoutEffect(() => {
    if (!onFirstLayoutReady || !tabActive || firstLayoutReadyRef.current) return
    if (viewport.width <= 0 || viewport.height <= 0) return
    const agents = entities.filter(entity => entity.kind === 'agent')
    if (agents.some(entity => !(agentHeights[entity.paneId] > 0))) return

    let cancelled = false
    let raf1 = 0
    let raf2 = 0
    const timer = window.setTimeout(() => {
      raf1 = window.requestAnimationFrame(() => {
        raf2 = window.requestAnimationFrame(() => {
          if (cancelled || firstLayoutReadyRef.current) return
          firstLayoutReadyRef.current = true
          onFirstLayoutReady()
        })
      })
    }, 64)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
      if (raf1) window.cancelAnimationFrame(raf1)
      if (raf2) window.cancelAnimationFrame(raf2)
    }
  }, [agentHeights, entities, onFirstLayoutReady, tabActive, viewport.height, viewport.width])

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

  // Solo terminales abren PaneWindow; agentes usan chat (onOpenChat).
  const terminalOpen = terminalsInOrder.some(entity => entity.window.open)
  const anyWindowOpen = terminalOpen
  // Con la mesa abierta la card de agente es un token que se arrastra a ella:
  // el reorder por handle movería la card de verdad (y pasaría bajo la mesa).
  const reorderEnabled = Boolean(onReorderPanes) && !anyWindowOpen && !seatDragEnabled

  const baselineLayout = useMemo(
    () => buildSlotOrigins(
      entities,
      viewport.width > 0 ? viewport : { width: 960, height: 640 },
      agentHeights,
      scrollOffsets,
    ),
    [entities, viewport, agentHeights, scrollOffsets],
  )
  const baselineSlots = baselineLayout.origins

  const maxScrollOffsets = useMemo<PlaneColumnScrollOffsets>(() => {
    const vh = viewport.height > 0 ? viewport.height : 640
    return {
      terminal: clampPlaneColumnScroll(baselineLayout.contentHeights.terminal, vh),
      agent: clampPlaneColumnScroll(baselineLayout.contentHeights.agent, vh),
    }
  }, [baselineLayout.contentHeights, viewport.height])

  // Re-clampa offsets si el contenido o el viewport encogen.
  useLayoutEffect(() => {
    setScrollOffsets(prev => {
      const terminal = Math.min(prev.terminal, maxScrollOffsets.terminal)
      const agent = Math.min(prev.agent, maxScrollOffsets.agent)
      return terminal === prev.terminal && agent === prev.agent
        ? prev
        : { terminal, agent }
    })
  }, [maxScrollOffsets])

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
    || terminalReorder.gestureActive
    || agentReorder.gestureActive

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
   * Scroll virtual por columna: mapa y columnas tienen pointer-events none,
   * así que el wheel se captura en window (capture) y se filtra por geometría.
   */
  const terminalCount = terminalsInOrder.length
  const agentCount = agentsInOrder.length
  useLayoutEffect(() => {
    const el = mapRef.current
    if (!el) return
    if (anyWindowOpen || reorderActive) return
    if (maxScrollOffsets.terminal <= 0 && maxScrollOffsets.agent <= 0) return
    const vp = viewport.width > 0 ? viewport : { width: 960, height: 640 }
    const columnCount = Math.max(terminalCount, agentCount, 1)
    const cell = computePlaneMiniSlotCell(vp, columnCount)
    const padX = computePlaneMiniSlotPadX(vp, columnCount)
    const agentX = Math.max(padX, vp.width - padX - cell.width)
    const tolerance = 24

    const onWheel = (event: WheelEvent): void => {
      if (event.ctrlKey) return
      const rect = el.getBoundingClientRect()
      if (rect.width === 0 || rect.height === 0) return
      if (
        event.clientX < rect.left
        || event.clientX > rect.right
        || event.clientY < rect.top
        || event.clientY > rect.bottom
      ) return
      // Modal o ventana expandida por encima del plano: scroll nativo.
      if (
        event.target instanceof Element
        && event.target.closest('.terminal-modal-root, .pane-window--full')
      ) return
      const x = event.clientX - rect.left
      let column: 'terminal' | 'agent' | null = null
      if (x >= padX - tolerance && x <= padX + cell.width + tolerance) {
        column = 'terminal'
      } else if (x >= agentX - tolerance && x <= agentX + cell.width + tolerance) {
        column = 'agent'
      }
      if (!column) return
      const maxOffset = column === 'terminal'
        ? maxScrollOffsets.terminal
        : maxScrollOffsets.agent
      if (maxOffset <= 0) return
      event.preventDefault()
      // Sin transición mientras rueda: el offset debe seguir 1:1 al wheel.
      setWheelScrolling(true)
      if (wheelScrollingTimeoutRef.current !== null) {
        window.clearTimeout(wheelScrollingTimeoutRef.current)
      }
      wheelScrollingTimeoutRef.current = window.setTimeout(() => {
        wheelScrollingTimeoutRef.current = null
        setWheelScrolling(false)
      }, 150)
      const key = column
      setScrollOffsets(prev => {
        const next = Math.min(maxOffset, Math.max(0, prev[key] + event.deltaY))
        return next === prev[key] ? prev : { ...prev, [key]: next }
      })
    }
    window.addEventListener('wheel', onWheel, { passive: false, capture: true })
    return () => {
      window.removeEventListener('wheel', onWheel, true)
      if (wheelScrollingTimeoutRef.current !== null) {
        window.clearTimeout(wheelScrollingTimeoutRef.current)
        wheelScrollingTimeoutRef.current = null
      }
    }
  }, [agentCount, anyWindowOpen, maxScrollOffsets, reorderActive, terminalCount, viewport])

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
      scrollOffsets,
    ).origins,
    [agentHeights, layoutEntities, scrollOffsets, viewport],
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
    const reserved = entity.kind !== 'agent' && entity.window.open
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
          seatDragEnabled={seatDragEnabled && !entity.localOnly && !entity.instanceTag}
          deferPositionMotion={deferPositionMotion}
          instanceTag={entity.instanceTag}
          replicaCount={entity.replicaCount}
          monogram={entity.monogram}
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
          tabActive={tabActive}
          contexts={entity.contexts}
          configLabel={configLabel}
          deleteLabel={deleteLabel}
          maximizeLabel={maximizeLabel}
          restoreLabel={restoreLabel}
          closeWindowLabel={closeWindowLabel}
          customTitle={entity.customTitle}
          folderName={entity.folderName}
          onExpand={() => onExpandEntity(entity.paneId)}
          onClose={() => onCloseWindow(entity.paneId)}
          onFocus={() => onFocusWindow(entity.paneId)}
          onToggleFullscreen={() => onToggleFullscreen(entity.paneId)}
          onOpenConfig={() => onOpenConfig(entity.paneId)}
          onOpenChat={() => onOpenChat(entity.paneId)}
          onDelete={() => onDeletePane(entity.paneId)}
          onRename={entity.kind === 'terminal' && onRenamePane
            ? next => onRenamePane(entity.paneId, next)
            : undefined}
          onDropContext={entity.kind === 'agent' && onAssignContext
            ? contextId => onAssignContext(entity.paneId, contextId)
            : undefined}
          onOpenResultsPreview={entity.kind === 'agent' ? onOpenResultsPreview : undefined}
          onMiniContentHeightChange={entity.kind === 'agent' ? handleAgentMiniHeight : undefined}
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
        wheelScrolling ? 'plane-map--wheel-scrolling' : '',
      ].filter(Boolean).join(' ')}
      aria-label={reorderActive ? reorderAriaLabel : undefined}
    >
      <PlaneMapBackdrop working={working} />
      {entities.length === 0 ? (
        <div className="plane-map__empty" aria-hidden="true" />
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
