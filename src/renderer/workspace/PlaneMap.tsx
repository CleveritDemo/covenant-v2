import React, { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { AgentCliProvider, PaneKind, PaneWindowState } from '@shared/tabSession'
import { hasNativeScrollAncestor } from './planeWheelTargets'
import {
  computePlaneColumnWindowing,
} from '@shared/planeColumnWindowing'
import {
  computePlaneMiniSlotCell,
  computePlaneMiniSlotPadX,
  computeStandardPaneWindowGeometry,
  estimatePlaneAgentMiniHeight,
  PLANE_MINI_BOTTOM_CLEARANCE,
  PLANE_MINI_SLOT_PAD_X,
  PLANE_MINI_SLOT_PAD_Y,
  PLANE_MINI_WINDOW_HEIGHT,
  PLANE_MINI_WINDOW_WIDTH,
  type PaneWindowGeometry,
} from '@shared/paneWindows'
import type { PaneReorderKind } from '../arrayReorder'
import { PlanePaneWindow, type PlaneAgentContextChip } from './PlanePaneWindow'
import { PlaneColumnOverflowPill } from './PlaneColumnOverflowPill'
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
  monogram?: string
  busy: boolean
  /** Trabajo reservado/activo por una delegación del orquestador. */
  delegationWorkActive?: boolean
  provider?: AgentCliProvider
  coordination?: 'none' | 'orchestrator' | 'productOwner'
  snippet?: string
  /** Slug del agente en catálogo (drag de results). */
  agentId?: string
  /** Agente localOnly del turbo: carril paralelo, no se publica al org workspace. */
  localOnly?: boolean
  /** Ids asignados en catálogo (fuente de verdad para selección en UI). */
  contextIds?: string[]
  contexts?: PlaneAgentContextChip[]
  threads?: { id: string; title: string; running: boolean }[]
  activeThreadId?: string
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
  /** Solo fondo: oculta el stage de ventanas (sin desmontarlas) dejando
   *  visibles atmósfera, grilla y partículas — p. ej. bajo el mapa wiki. */
  stageHidden?: boolean
  /** Overlay del mapa wiki: se monta sobre el backdrop y bajo el stage oculto. */
  wikiOverlay?: React.ReactNode
  /** Mesa de brainstorm abierta: las cards de agente se arrastran a ella. */
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
  /** Carpeta del proyecto: la usa el chip jira anidado en un mini para pedir su preview vía IPC. */
  cwd?: string
  /** Sube cuando los contextos se remateralizan; el chip jira relee su snapshot. */
  contextsRevision?: number
  onOpenThread?: (paneId: string, threadId: string) => void
}

export interface PlaneColumnScrollOffsets {
  terminal: number
  agent: number
}

const ZERO_SCROLL_OFFSETS: PlaneColumnScrollOffsets = { terminal: 0, agent: 0 }

/** Floor busy aurora only; grid/music particles stay on via `tabActive`. */
export function planeFloorAuroraActive(
  working: boolean | undefined,
  stageHidden: boolean,
): boolean {
  return Boolean(working) && !stageHidden
}

export interface PlaneColumnHiddenIds {
  above: string[]
  below: string[]
}

interface PlaneSlotLayout {
  origins: Record<string, PaneWindowGeometry>
  visibleById: Record<string, boolean>
  hidden: {
    terminal: PlaneColumnHiddenIds
    agent: PlaneColumnHiddenIds
  }
  /** Altura total de contenido por columna (sin clearance inferior). */
  contentHeights: PlaneColumnScrollOffsets
  maxScrollOffsets: PlaneColumnScrollOffsets
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
  const visibleById: Record<string, boolean> = {}
  const terminals = entities.filter(entity => entity.kind !== 'agent')
  const agents = entities.filter(entity => entity.kind === 'agent')
  const columnCount = Math.max(terminals.length, agents.length, 1)
  const cell = computePlaneMiniSlotCell(viewport, columnCount)
  const padX = computePlaneMiniSlotPadX(viewport, columnCount)
  const agentX = Math.max(padX, vw - padX - cell.width)

  const terminalWindow = computePlaneColumnWindowing({
    items: terminals.map(entity => ({
      id: entity.paneId,
      height: cell.height,
    })),
    viewportHeight: viewport.height,
    scrollOffset: scrollOffsets.terminal,
  })
  for (const slot of terminalWindow.slots) {
    visibleById[slot.id] = slot.visible
    origins[slot.id] = {
      x: padX,
      y: slot.y,
      width: cell.width,
      height: slot.height,
    }
  }

  const agentWindow = computePlaneColumnWindowing({
    items: agents.map(entity => {
      const measured = agentHeights[entity.paneId]
      return {
        id: entity.paneId,
        height: measured && measured > 0
          ? measured
          : estimatePlaneAgentMiniHeight(entity.contexts?.length ?? 0),
      }
    }),
    viewportHeight: viewport.height,
    scrollOffset: scrollOffsets.agent,
  })
  for (const slot of agentWindow.slots) {
    visibleById[slot.id] = slot.visible
    origins[slot.id] = {
      x: agentX,
      y: slot.y,
      width: cell.width,
      height: slot.height,
    }
  }

  return {
    origins,
    visibleById,
    hidden: {
      terminal: {
        above: terminalWindow.hiddenAbove,
        below: terminalWindow.hiddenBelow,
      },
      agent: {
        above: agentWindow.hiddenAbove,
        below: agentWindow.hiddenBelow,
      },
    },
    contentHeights: {
      terminal: terminalWindow.contentHeight,
      agent: agentWindow.contentHeight,
    },
    maxScrollOffsets: {
      terminal: terminalWindow.maxScroll,
      agent: agentWindow.maxScroll,
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
  stageHidden = false,
  wikiOverlay = null,
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
  cwd = '',
  contextsRevision = 0,
  onOpenThread,
}) => {
  const mapRef = useRef<HTMLDivElement>(null)
  const [viewport, setViewport] = useState({ width: 0, height: 0 })
  const [agentHeights, setAgentHeights] = useState<Record<string, number>>({})
  const [threadNodesExpanded, setThreadNodesExpanded] = useState<Record<string, boolean>>({})
  const [scrollOffsets, setScrollOffsets] = useState<PlaneColumnScrollOffsets>(ZERO_SCROLL_OFFSETS)
  const [wheelScrolling, setWheelScrolling] = useState(false)
  const wheelScrollingTimeoutRef = useRef<number | null>(null)
  const firstLayoutReadyRef = useRef(false)
  const reducedMotion = usePrefersReducedMotion()

  const handleAgentMiniHeight = useCallback((paneId: string, height: number) => {
    setAgentHeights(prev => (prev[paneId] === height ? prev : { ...prev, [paneId]: height }))
  }, [])

  const handleToggleThreadNodes = useCallback((paneId: string) => {
    setThreadNodesExpanded(prev => ({ ...prev, [paneId]: !prev[paneId] }))
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
    setThreadNodesExpanded(prev => {
      let changed = false
      const next: Record<string, boolean> = {}
      for (const [id, expanded] of Object.entries(prev)) {
        if (agentIds.has(id)) next[id] = expanded
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
  const reorderEnabled = Boolean(onReorderPanes) && !anyWindowOpen

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

  const maxScrollOffsets = useMemo(
    () => baselineLayout.maxScrollOffsets,
    [baselineLayout],
  )

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

  const columnGeometry = useMemo(() => {
    const vp = viewport.width > 0 ? viewport : { width: 960, height: 640 }
    const columnCount = Math.max(terminalCount, agentCount, 1)
    const cell = computePlaneMiniSlotCell(vp, columnCount)
    const padX = computePlaneMiniSlotPadX(vp, columnCount)
    return {
      padX,
      agentX: Math.max(padX, vp.width - padX - cell.width),
      cellWidth: cell.width,
    }
  }, [agentCount, terminalCount, viewport])

  const scrollColumnBy = useCallback((
    column: 'terminal' | 'agent',
    direction: 'up' | 'down',
  ) => {
    const vh = viewport.height > 0 ? viewport.height : 640
    const step = Math.max(
      80,
      vh - PLANE_MINI_BOTTOM_CLEARANCE - PLANE_MINI_SLOT_PAD_Y,
    )
    setScrollOffsets(prev => {
      const max = column === 'terminal'
        ? maxScrollOffsets.terminal
        : maxScrollOffsets.agent
      const delta = direction === 'down' ? step : -step
      const next = Math.min(max, Math.max(0, prev[column] + delta))
      return next === prev[column] ? prev : { ...prev, [column]: next }
    })
  }, [maxScrollOffsets, viewport.height])

  useLayoutEffect(() => {
    const el = mapRef.current
    if (!el) return
    // Con ventana abierta la columna sigue detrás y debe poder desplazarse.
    if (reorderActive) return
    if (maxScrollOffsets.terminal <= 0 && maxScrollOffsets.agent <= 0) return
    const vp = viewport.width > 0 ? viewport : { width: 960, height: 640 }
    const columnCount = Math.max(terminalCount, agentCount, 1)
    const cell = computePlaneMiniSlotCell(vp, columnCount)
    const padX = computePlaneMiniSlotPadX(vp, columnCount)
    const agentX = Math.max(padX, vp.width - padX - cell.width)
    const tolerance = Math.max(24, Math.round(cell.width / 2))

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
      // Algo por encima del plano que ya sabe scrollear (modal, ventana
      // expandida, un desplegable): la rueda es suya. Se comprueba por
      // capacidad y no solo por una lista de selectores —la lista se quedaba
      // corta cada vez que aparecía un overlay nuevo—, y se respeta además el
      // opt-out explícito `data-plane-native-scroll`.
      if (
        event.target instanceof Element
        && (
          event.target.closest(
            '.terminal-modal-root, .pane-window--full, [data-plane-native-scroll]',
          )
          || hasNativeScrollAncestor(event.target, el)
        )
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
  }, [agentCount, maxScrollOffsets, reorderActive, terminalCount, viewport])

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

  const renderLayout = useMemo(
    () => buildSlotOrigins(
      layoutEntities,
      viewport.width > 0 ? viewport : { width: 960, height: 640 },
      agentHeights,
      scrollOffsets,
    ),
    [agentHeights, layoutEntities, scrollOffsets, viewport],
  )
  const slotOrigins = renderLayout.origins
  const visibleById = renderLayout.visibleById

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
          seatDragEnabled={seatDragEnabled && !entity.localOnly}
          deferPositionMotion={deferPositionMotion}
          outOfBand={visibleById[entity.paneId] === false}
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
          cwd={cwd}
          contextsRevision={contextsRevision}
          threadNodes={entity.kind === 'agent' && entity.threads
            ? entity.threads.map(thread => ({
              ...thread,
              active: thread.id === entity.activeThreadId,
            }))
            : undefined}
          threadNodesExpanded={threadNodesExpanded[entity.paneId] ?? false}
          onToggleThreadNodes={entity.kind === 'agent' && onOpenThread
            ? () => handleToggleThreadNodes(entity.paneId)
            : undefined}
          onOpenThread={entity.kind === 'agent' && onOpenThread
            ? threadId => onOpenThread(entity.paneId, threadId)
            : undefined}
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
        stageHidden ? 'plane-map--stage-hidden' : '',
      ].filter(Boolean).join(' ')}
      aria-label={reorderActive ? reorderAriaLabel : undefined}
    >
      <PlaneMapBackdrop />
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

      {entities.length > 0 && !reorderActive ? (
        <div className="plane-map__overflow">
          {terminalsInOrder.length > 0 ? (
            <div
              className={[
                'plane-map__overflow-column',
                'plane-map__overflow-column--terminals',
              ].join(' ')}
              style={{
                left: columnGeometry.padX,
                width: columnGeometry.cellWidth,
              }}
            >
              <PlaneColumnOverflowPill
                count={baselineLayout.hidden.terminal.above.length}
                direction="up"
                onClick={() => scrollColumnBy('terminal', 'up')}
              />
              <PlaneColumnOverflowPill
                count={baselineLayout.hidden.terminal.below.length}
                direction="down"
                onClick={() => scrollColumnBy('terminal', 'down')}
              />
            </div>
          ) : null}
          {agentsInOrder.length > 0 ? (
            <div
              className={[
                'plane-map__overflow-column',
                'plane-map__overflow-column--agents',
              ].join(' ')}
              style={{
                left: columnGeometry.agentX,
                width: columnGeometry.cellWidth,
              }}
            >
              <PlaneColumnOverflowPill
                count={baselineLayout.hidden.agent.above.length}
                direction="up"
                onClick={() => scrollColumnBy('agent', 'up')}
              />
              <PlaneColumnOverflowPill
                count={baselineLayout.hidden.agent.below.length}
                direction="down"
                onClick={() => scrollColumnBy('agent', 'down')}
              />
            </div>
          ) : null}
        </div>
      ) : null}

    </div>
  )
}
