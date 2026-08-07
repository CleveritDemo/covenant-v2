import React, { useCallback, useLayoutEffect, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { Icon } from '../components/ui/Icon'
import {
  PANE_WINDOW_MIN_HEIGHT,
  PANE_WINDOW_MIN_WIDTH,
  PLANE_MINI_AGENT_HEIGHT,
  PLANE_MINI_AGENT_WIDTH,
  PLANE_MINI_TITLEBAR_HEIGHT,
  PLANE_MINI_WINDOW_HEIGHT,
  PLANE_MINI_WINDOW_WIDTH,
  type PaneWindowGeometry,
} from '@shared/paneWindows'
import { MAX_PANE_TITLE_LENGTH } from '@shared/tabSession'
import { isMiniExpandSuppressed } from './miniExpandSuppress'
import { PlaneBusyDot } from './PlaneBusyDot'
import {
  hasPlaneContextDrag,
  readPlaneContextDragData,
} from './planeContextDrag'
import { isReduceMotionActive } from '../reduceMotion'
import './PaneWindow.css'
import './PlaneChatActive.css'

export type PaneWindowDisplay = 'mini' | 'full'

export type PaneWindowLayoutGeometry = PaneWindowGeometry & {
  zIndex: number
  fullscreen: boolean
}

export const PANE_ZOOM_MS = 300

/**
 * Misma sombra local que las terminales en CSS (tamaño mini real).
 * Intensidad vía --plane-mini-card-shadow (más suave en temas claros).
 */
function agentMiniBoxShadow(): string {
  return 'var(--plane-mini-card-shadow)'
}

type LayoutBox = {
  left: number
  top: number
  width: number | string
  height: number | string
  zIndex: number
}

type RectBox = { x: number; y: number; w: number; h: number }

function prefersReducedMotion(): boolean {
  return isReduceMotionActive()
}

function readOffsetParentSize(el: HTMLElement | null): { w: number; h: number } | null {
  const parent = el?.offsetParent
  if (!(parent instanceof HTMLElement)) return null
  const w = parent.clientWidth
  const h = parent.clientHeight
  if (w <= 0 || h <= 0) return null
  return { w, h }
}

/** Cover uniforme del shell full dentro de la ranura mini (mismo header + body).
 * Anclado arriba-izquierda: centrar en X/Y corta traffic lights y titlebar. */
function liveShellCover(
  mini: RectBox,
  fullW: number,
  fullH: number,
): { scale: number; offsetX: number; offsetY: number } {
  const width = Math.max(fullW, 1)
  const height = Math.max(fullH, 1)
  const scale = Math.max(mini.w / width, mini.h / height)
  return {
    scale,
    offsetX: 0,
    offsetY: 0,
  }
}

/**
 * Transform del root a tamaño full que equivale visualmente al mini con shell cover.
 * Usa la misma escala uniforme (no sx/sy distintos → sin estirar el PTY).
 */
function liveParkedTransform(
  mini: RectBox,
  geo: { x: number; y: number; width: number; height: number },
): string {
  const { scale, offsetX, offsetY } = liveShellCover(mini, geo.width, geo.height)
  const dx = mini.x + offsetX - geo.x
  const dy = mini.y + offsetY - geo.y
  return `translate(${dx}px, ${dy}px) scale(${scale})`
}

type PaneZoomSetters = {
  setZoomMode: (mode: 'idle' | 'expand' | 'collapse') => void
  setZoomPrep: (prep: boolean) => void
  setLayoutOverride: (layout: LayoutBox | null) => void
}

/** Limpia estilos inline del morph en el nodo animado. */
export function clearPaneMorphNodeStyles(node: HTMLElement): void {
  node.style.transform = ''
  node.style.borderRadius = ''
  node.style.transition = ''
  node.style.transformOrigin = ''
}

/**
 * Resetea estado React del morph (finish e interrupt cleanup).
 * Sin esto, un cleanup a mitad deja layoutOverride/zoomMode pegados → pantalla negra.
 */
export function resetPaneZoomSurfaceState(setters: PaneZoomSetters): void {
  flushSync(() => {
    setters.setLayoutOverride(null)
    setters.setZoomMode('idle')
    setters.setZoomPrep(false)
  })
}

/** Morph FLIP vía Web Animations API (fiable en Electron; no pelea con CSS tilt). */
function runPaneTransformMorph(options: {
  root: HTMLElement | null
  mode: 'expand' | 'collapse'
  layout: LayoutBox
  startTransform: string
  endTransform: string
  setZoomMode: (mode: 'idle' | 'expand' | 'collapse') => void
  setZoomPrep: (prep: boolean) => void
  setLayoutOverride: (layout: LayoutBox | null) => void
  onFinished: () => void
}): () => void {
  const {
    root,
    mode,
    layout,
    startTransform,
    endTransform,
    setZoomMode,
    setZoomPrep,
    setLayoutOverride,
    onFinished,
  } = options
  const zoomSetters: PaneZoomSetters = { setZoomMode, setZoomPrep, setLayoutOverride }

  let finished = false
  flushSync(() => {
    setZoomMode(mode)
    setZoomPrep(true)
    setLayoutOverride(layout)
  })

  const node = root
  if (!node) {
    onFinished()
    resetPaneZoomSurfaceState(zoomSetters)
    return () => {}
  }

  node.style.transformOrigin = 'top left'
  node.style.transition = 'none'
  node.style.transform = startTransform
  void node.offsetWidth
  flushSync(() => {
    setZoomPrep(false)
  })

  const anim = node.animate(
    [
      { transform: startTransform },
      { transform: endTransform },
    ],
    {
      duration: PANE_ZOOM_MS,
      easing: 'cubic-bezier(0.05, 0.9, 0.08, 1)',
      fill: 'forwards',
    },
  )

  const finish = (): void => {
    if (finished) return
    finished = true
    try {
      anim.commitStyles()
    } catch { /* ignore */ }
    try {
      anim.cancel()
    } catch { /* ignore */ }
    onFinished()
    resetPaneZoomSurfaceState(zoomSetters)
    clearPaneMorphNodeStyles(node)
  }

  anim.addEventListener('finish', finish)
  const timer = window.setTimeout(finish, PANE_ZOOM_MS + 64)
  return () => {
    window.clearTimeout(timer)
    // Éxito ya pasó por finish(): no re-commit ni re-reset.
    if (finished) {
      try {
        anim.cancel()
      } catch { /* ignore */ }
      clearPaneMorphNodeStyles(node)
      return
    }
    finished = true
    try {
      anim.commitStyles()
    } catch { /* ignore */ }
    try {
      anim.cancel()
    } catch { /* ignore */ }
    // Interrupt: misma salida que finish → prevDisplayRef y zoom idle coherentes.
    onFinished()
    resetPaneZoomSurfaceState(zoomSetters)
    clearPaneMorphNodeStyles(node)
  }
}

export interface PaneWindowProps {
  title: string
  display: PaneWindowDisplay
  geometry: PaneWindowLayoutGeometry
  /** Ranura mini en coords del plano (misma div anima hacia geometry). */
  miniOrigin: { x: number; y: number; width?: number; height?: number }
  focused?: boolean
  busy?: boolean
  /** Mini agente: chat abierto en el plano (selección estática, ortogonal a busy). */
  chatActive?: boolean
  maximizeLabel: string
  restoreLabel: string
  closeLabel: string
  configureLabel?: string
  onConfigure?: () => void
  /** Renombra el pane (doble clic en el título de la ventana expandida). */
  onRename?: (next: string) => void
  renameLabel?: string
  miniFace?: React.ReactNode
  miniActions?: React.ReactNode
  /** Badge de carpeta actual en el mini (solo basename). */
  miniFolderBadge?: React.ReactNode
  /** En mini: muestra el pane real escalado (p. ej. terminal) en vez de aparcarlo. */
  miniLivePreview?: boolean
  /** Card de agente: proporciones y marco propios. */
  miniAgentCard?: boolean
  /** Muestra la titlebar (por defecto sí, excepto minis sin marco). */
  showTitlebar?: boolean
  children: React.ReactNode
  onExpand?: () => void
  onToggleFullscreen?: () => void
  onClose: () => void
  onFocus: () => void
  /** Drop de un contexto del pool sobre este pane (agentes). */
  onDropContext?: (contextId: string) => void
  /** Id del pane (para reportar altura mini estable al padre). */
  paneId?: string
  /** Altura real del mini agente (contenido) para apilar en el plano. */
  onMiniContentHeightChange?: (paneId: string, height: number) => void
  /** Long-press / DnD de reorden en el plano (minis). */
  reorderEnabled?: boolean
  reorderState?: 'idle' | 'jiggle' | 'dragging' | 'previewMoving'
  /** Desfase del jiggle (ms) para desincronizar cards. */
  reorderJiggleDelayMs?: number
  /** Anima left/top al cambiar de ranura (p. ej. preview de reorder). */
  slotMotion?: boolean
  onReorderPointerDown?: (event: React.PointerEvent) => void
  /** Clases extra en el root (p. ej. entrada del explorer). */
  className?: string
  /** Estilos extra en el root (p. ej. --ox/--oy del zoom de entrada). */
  style?: React.CSSProperties
}

export const PaneWindow: React.FC<PaneWindowProps> = ({
  title,
  display,
  geometry,
  miniOrigin,
  focused = false,
  busy = false,
  chatActive = false,
  maximizeLabel,
  restoreLabel,
  closeLabel,
  configureLabel,
  onConfigure,
  onRename,
  renameLabel,
  miniFace,
  miniActions,
  miniFolderBadge,
  miniLivePreview = false,
  miniAgentCard = false,
  showTitlebar = true,
  children,
  onExpand,
  onToggleFullscreen,
  onClose,
  onFocus,
  onDropContext,
  paneId,
  onMiniContentHeightChange,
  reorderEnabled = false,
  reorderState = 'idle',
  reorderJiggleDelayMs = 0,
  slotMotion = false,
  onReorderPointerDown,
  className,
  style: styleProp,
}) => {
  const isMini = display === 'mini'
  const isFullscreen = !isMini && geometry.fullscreen
  const prevDisplayRef = useRef(display)
  const [contextDropActive, setContextDropActive] = useState(false)
  const [renameDraft, setRenameDraft] = useState<string | null>(null)
  const geometryRef = useRef(geometry)
  const miniOriginRef = useRef(miniOrigin)
  const rootRef = useRef<HTMLDivElement>(null)
  geometryRef.current = geometry
  miniOriginRef.current = miniOrigin

  const [zoomMode, setZoomMode] = useState<'idle' | 'expand' | 'collapse'>('idle')
  const [zoomPrep, setZoomPrep] = useState(false)
  const [layoutOverride, setLayoutOverride] = useState<LayoutBox | null>(null)

  const sizeW = geometry.width
  const sizeH = geometry.height
  // Mini: misma ranura para terminales y agentes (dinámica por viewport).
  const miniW = miniOrigin.width > 0
    ? miniOrigin.width
    : (miniAgentCard ? PLANE_MINI_AGENT_WIDTH : PLANE_MINI_WINDOW_WIDTH)
  const miniH = miniOrigin.height > 0
    ? miniOrigin.height
    : (miniAgentCard ? PLANE_MINI_AGENT_HEIGHT : PLANE_MINI_WINDOW_HEIGHT)

  const zooming = zoomMode !== 'idle'
  const showAsMini = isMini && !zooming
  const titlebarVisible = showTitlebar || zooming || (miniLivePreview && showAsMini)
  // Shell live siempre a tamaño full (header incluido); mini solo lo escala.
  const chromeH = (titlebarVisible || miniLivePreview) ? PLANE_MINI_TITLEBAR_HEIGHT : 0
  const parkBodyW = sizeW
  const parkBodyH = Math.max(1, sizeH - chromeH)
  const miniBox: RectBox = { x: miniOrigin.x, y: miniOrigin.y, w: miniW, h: miniH }
  const shellCover = liveShellCover(miniBox, sizeW, sizeH)
  /** Mini live: cover del shell entero (mismo header que full, solo escalado). */
  const shellCoverActive = Boolean(miniLivePreview && showAsMini)

  const fullLayout: LayoutBox = {
    left: geometry.x,
    top: geometry.y,
    width: sizeW,
    height: sizeH,
    zIndex: geometry.zIndex,
  }

  const miniLayout: LayoutBox = {
    left: miniOrigin.x,
    top: miniOrigin.y,
    width: miniW,
    // Agente mini: el CSS usa height:auto al contenido; el nº solo sirve al morph.
    height: miniAgentCard ? 'auto' : miniH,
    zIndex: geometry.zIndex,
  }

  const targetLayout: LayoutBox = isFullscreen && !isMini && !zooming
    ? {
        left: 0,
        top: 0,
        width: '100%',
        height: '100%',
        zIndex: geometry.zIndex,
      }
    : showAsMini
      ? miniLayout
      : fullLayout

  const layout = layoutOverride ?? targetLayout

  const [motionReady, setMotionReady] = useState(false)
  useLayoutEffect(() => {
    const id = window.requestAnimationFrame(() => setMotionReady(true))
    return () => window.cancelAnimationFrame(id)
  }, [])

  // Mini agente: reportar altura real del contenido (height:auto) para el apilado.
  const lastReportedHeightRef = useRef(0)
  useLayoutEffect(() => {
    if (!showAsMini || !miniAgentCard || !onMiniContentHeightChange || !paneId) return
    const el = rootRef.current
    if (!el) return
    const report = (): void => {
      const next = Math.ceil(el.getBoundingClientRect().height)
      if (next <= 0) return
      if (Math.abs(next - lastReportedHeightRef.current) <= 1) return
      lastReportedHeightRef.current = next
      onMiniContentHeightChange(paneId, next)
    }
    report()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(report)
    observer.observe(el)
    return () => observer.disconnect()
  }, [showAsMini, miniAgentCard, onMiniContentHeightChange, paneId])

  const stageEase = `${PANE_ZOOM_MS}ms cubic-bezier(0.05, 0.9, 0.08, 1)`
  // Terminales live: nunca animar width/height (el fit intermedio hace saltar el texto).
  // Agentes mini: sin animar height (es auto al contenido).
  // Reorder: animar left/top también en live preview para el preview fluido.
  const stageTransition = motionReady && !zooming && (
    !miniLivePreview || slotMotion
  )
    ? (
      miniAgentCard || slotMotion
        ? `left ${stageEase}, top ${stageEase}, width ${stageEase}, box-shadow ${PANE_ZOOM_MS}ms ease`
        : `left ${stageEase}, top ${stageEase}, width ${stageEase}, height ${stageEase}, box-shadow ${PANE_ZOOM_MS}ms ease`
    )
    : undefined

  useLayoutEffect(() => {
    const prev = prevDisplayRef.current
    if (prev === display) return

    // Al volver a mini, el traffic light del full suele conservar el foco y
    // dejaba las acciones del corner “pegadas” (focus-within / hover fantasma).
    if (display === 'mini') {
      const active = document.activeElement
      if (active instanceof HTMLElement && rootRef.current?.contains(active)) {
        active.blur()
      }
    }

    const geo = geometryRef.current
    const origin = miniOriginRef.current
    // Mini size desde refs: cambios de ranura mid-morph no reinician el efecto.
    const slotW = origin.width > 0
      ? origin.width
      : (miniAgentCard ? PLANE_MINI_AGENT_WIDTH : PLANE_MINI_WINDOW_WIDTH)
    const slotH = origin.height > 0
      ? origin.height
      : (miniAgentCard ? PLANE_MINI_AGENT_HEIGHT : PLANE_MINI_WINDOW_HEIGHT)
    const slot: RectBox = {
      x: origin.x,
      y: origin.y,
      w: slotW,
      h: slotH,
    }
    // Live terminal: misma escala uniforme del shell cover. Resto: fit exacto de caja.
    const parked = miniLivePreview
      ? liveParkedTransform(slot, geo)
      : (() => {
          const sx = slot.w / Math.max(geo.width, 1)
          const sy = slot.h / Math.max(geo.height, 1)
          const dx = slot.x - geo.x
          const dy = slot.y - geo.y
          return `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`
        })()
    const identity = 'translate(0px, 0px) scale(1)'

    const resetZoom = (): void => {
      resetPaneZoomSurfaceState({ setLayoutOverride, setZoomMode, setZoomPrep })
    }

    const commitDisplay = (): void => {
      prevDisplayRef.current = display
    }

    // Agentes mini↔centro: transición CSS de left/top/width/height.
    // Terminales live: morph FLIP (el PTY debe quedarse a tamaño full; si no, fit mini→full salta el texto).
    if (!geo.fullscreen && miniAgentCard) {
      commitDisplay()
      resetZoom()
      return
    }

    if (prev === 'mini' && display === 'full' && !geo.fullscreen) {
      if (prefersReducedMotion()) {
        commitDisplay()
        resetZoom()
        return
      }
      const end: LayoutBox = {
        left: geo.x,
        top: geo.y,
        width: geo.width,
        height: geo.height,
        zIndex: Math.max(geo.zIndex, 140),
      }
      return runPaneTransformMorph({
        root: rootRef.current,
        mode: 'expand',
        layout: end,
        startTransform: parked,
        endTransform: identity,
        setZoomMode,
        setZoomPrep,
        setLayoutOverride,
        onFinished: commitDisplay,
      })
    }

    if (prev === 'full' && display === 'mini') {
      if (prefersReducedMotion()) {
        commitDisplay()
        resetZoom()
        return
      }
      return runPaneTransformMorph({
        root: rootRef.current,
        mode: 'collapse',
        layout: {
          left: geo.x,
          top: geo.y,
          width: geo.width,
          height: geo.height,
          zIndex: Math.max(geo.zIndex, 100),
        },
        startTransform: identity,
        endTransform: parked,
        setZoomMode,
        setZoomPrep,
        setLayoutOverride,
        onFinished: commitDisplay,
      })
    }

    commitDisplay()
    resetZoom()
    // Solo `display` dispara morph; miniH/W se leen de refs (evita cleanup mid-gesture).
  }, [display, miniAgentCard, miniLivePreview])

  const prevFullscreenRef = useRef(geometry.fullscreen)

  // Maximizar / restaurar: morph FLIP en coords del plano.
  useLayoutEffect(() => {
    const prev = prevFullscreenRef.current
    const next = geometry.fullscreen
    if (prev === next) return

    if (display !== 'full') {
      prevFullscreenRef.current = next
      return
    }

    const commitFs = (): void => {
      prevFullscreenRef.current = next
    }

    if (prefersReducedMotion()) {
      commitFs()
      return
    }

    const geo = geometryRef.current
    const map = readOffsetParentSize(rootRef.current)
    const zoomZ = Math.max(geo.zIndex, 120)

    if (!map) {
      commitFs()
      return
    }

    if (next) {
      const end: LayoutBox = {
        left: 0,
        top: 0,
        width: map.w,
        height: map.h,
        zIndex: zoomZ,
      }
      const sx = geo.width / Math.max(map.w, 1)
      const sy = geo.height / Math.max(map.h, 1)
      return runPaneTransformMorph({
        root: rootRef.current,
        mode: 'expand',
        layout: end,
        startTransform: `translate(${geo.x}px, ${geo.y}px) scale(${sx}, ${sy})`,
        endTransform: 'translate(0px, 0px) scale(1, 1)',
        setZoomMode,
        setZoomPrep,
        setLayoutOverride,
        onFinished: commitFs,
      })
    }

    const start: LayoutBox = {
      left: 0,
      top: 0,
      width: map.w,
      height: map.h,
      zIndex: zoomZ,
    }
    const sx = geo.width / Math.max(map.w, 1)
    const sy = geo.height / Math.max(map.h, 1)
    return runPaneTransformMorph({
      root: rootRef.current,
      mode: 'collapse',
      layout: start,
      startTransform: 'translate(0px, 0px) scale(1, 1)',
      endTransform: `translate(${geo.x}px, ${geo.y}px) scale(${sx}, ${sy})`,
      setZoomMode,
      setZoomPrep,
      setLayoutOverride,
      onFinished: commitFs,
    })
  }, [display, geometry.fullscreen])

  const onTitlePointerDown = useCallback((event: React.PointerEvent) => {
    if (event.button !== 0) return
    onFocus()
    if (!isMini) return
    if ((event.target as HTMLElement | null)?.closest?.('button, a, input, select, textarea, [role="button"]')) {
      return
    }
    if (isMiniExpandSuppressed()) return
    if (reorderEnabled && onReorderPointerDown) {
      onReorderPointerDown(event)
      return
    }
    // Expandir en pointerdown (no esperar al click/mouseup → se siente con delay).
    event.preventDefault()
    onExpand?.()
  }, [isMini, onExpand, onFocus, onReorderPointerDown, reorderEnabled])

  const onBodyPointerDown = useCallback((event: React.PointerEvent) => {
    if (!isMini || event.button !== 0) return
    if (isMiniExpandSuppressed()) return
    if ((event.target as HTMLElement | null)?.closest?.('button, a, input, select, textarea, [role="button"]')) {
      return
    }
    // Agentes mini: clic abre chat; reorder solo vía handle.
    if (miniAgentCard) {
      event.preventDefault()
      onFocus()
      onExpand?.()
      return
    }
    if (reorderEnabled && onReorderPointerDown) {
      onFocus()
      onReorderPointerDown(event)
      return
    }
    event.preventDefault()
    onFocus()
    onExpand?.()
  }, [isMini, miniAgentCard, onExpand, onFocus, onReorderPointerDown, reorderEnabled])

  const onContextDragOver = useCallback((event: React.DragEvent) => {
    if (!onDropContext || !hasPlaneContextDrag(event.dataTransfer)) return
    event.preventDefault()
    event.stopPropagation()
    event.dataTransfer.dropEffect = 'copy'
    setContextDropActive(true)
  }, [onDropContext])

  const onContextDragLeave = useCallback((event: React.DragEvent) => {
    if (!onDropContext) return
    const next = event.relatedTarget as Node | null
    if (next && rootRef.current?.contains(next)) return
    setContextDropActive(false)
  }, [onDropContext])

  const onContextDrop = useCallback((event: React.DragEvent) => {
    if (!onDropContext) return
    if (!hasPlaneContextDrag(event.dataTransfer)) return
    event.preventDefault()
    event.stopPropagation()
    setContextDropActive(false)
    const contextId = readPlaneContextDragData(event.dataTransfer)
    if (contextId) onDropContext(contextId)
  }, [onDropContext])

  const parkWidth = Math.max(PANE_WINDOW_MIN_WIDTH, geometry.width)
  const parkHeight = Math.max(PANE_WINDOW_MIN_HEIGHT, geometry.height)

  // Terminales: host siempre activo (mismo tamaño). Agentes mini: aparcados + face.
  const liveHostMode = (!isMini || zooming || miniLivePreview)
    ? 'active'
    : 'parked'

  // Misma caja/sombra mini en reposo y busy (sin glow).
  const agentParkedShadow = showAsMini && miniAgentCard && !isFullscreen
    ? agentMiniBoxShadow()
    : undefined

  return (
    <div
      ref={rootRef}
      className={[
        'pane-window',
        showAsMini ? 'pane-window--mini' : 'pane-window--full',
        showAsMini && miniAgentCard ? 'pane-window--agent-card' : '',
        showAsMini && miniLivePreview ? 'pane-window--mini-preview' : '',
        showAsMini && !titlebarVisible ? 'pane-window--mini-bare' : '',
        isFullscreen && !zooming ? 'pane-window--fullscreen' : '',
        zooming ? 'pane-window--zooming' : '',
        zoomPrep ? 'pane-window--zooming-prep' : '',
        zoomMode === 'expand' ? 'pane-window--zooming-expand' : '',
        zoomMode === 'collapse' ? 'pane-window--zooming-collapse' : '',
        zoomMode === 'expand' && geometry.fullscreen ? 'pane-window--zooming-to-fullscreen' : '',
        focused ? 'pane-window--focused' : '',
        busy ? 'pane-window--busy' : '',
        showAsMini && miniAgentCard && chatActive ? 'pane-window--chat-active plane-chat-active' : '',
        contextDropActive ? 'pane-window--context-drop' : '',
        showAsMini && reorderState === 'jiggle' ? 'pane-window--reorder-jiggle' : '',
        showAsMini && reorderState === 'dragging' ? 'pane-window--reorder-dragging' : '',
        showAsMini && reorderState === 'previewMoving' ? 'pane-window--reorder-preview' : '',
        className ?? '',
      ].filter(Boolean).join(' ')}
      style={{
        left: layout.left,
        top: layout.top,
        width: layout.width,
        height: layout.height,
        zIndex: (() => {
          const base = Number(layout.zIndex) || 0
          if (showAsMini && reorderState === 'dragging') return Math.max(base, 160)
          // Al cambiar de terminal, expand y collapse corren a la vez: el que
          // abre debe ir encima desde el primer frame (no al terminar).
          if (zoomMode === 'expand') return Math.max(base, 140)
          if (zoomMode === 'collapse') return Math.max(base, 100)
          if (!isMini && !isFullscreen) return Math.max(base, 120)
          return base
        })(),
        ...(reorderState === 'jiggle'
          ? { ['--pane-jiggle-delay' as string]: `${reorderJiggleDelayMs}ms` }
          : null),
        ...(stageTransition && reorderState !== 'dragging' ? { transition: stageTransition } : null),
        ...(agentParkedShadow ? { boxShadow: agentParkedShadow } : null),
        ...styleProp,
      }}
      onMouseDown={event => {
        onFocus()
        event.stopPropagation()
      }}
      onDragOver={onDropContext ? onContextDragOver : undefined}
      onDragLeave={onDropContext ? onContextDragLeave : undefined}
      onDrop={onDropContext ? onContextDrop : undefined}
    >
      {/* Montar durante zoom para fade; no cortar half-out al expand/collapse. */}
      {(showAsMini || zooming) && miniActions ? (
        <div className="pane-window__mini-corner">
          {miniActions}
        </div>
      ) : null}
      {(showAsMini || zooming) && miniFolderBadge ? (
        <div className="pane-window__mini-folder">
          {miniFolderBadge}
        </div>
      ) : null}
      <div className="pane-window__frame">
      <div
        className={[
          'pane-window__shell',
          shellCoverActive ? 'pane-window__shell--live-cover' : '',
        ].filter(Boolean).join(' ')}
        style={shellCoverActive
          ? {
              width: sizeW,
              height: sizeH,
              transformOrigin: 'top left',
              transform: `translate(${shellCover.offsetX}px, ${shellCover.offsetY}px) scale(${shellCover.scale})`,
            }
          : zooming && miniLivePreview
            ? {
                // Durante el morph el root lleva la escala; shell a tamaño full.
                width: sizeW,
                height: sizeH,
              }
            : undefined}
      >
        {titlebarVisible && (
        <header
          className="pane-window__titlebar"
          onPointerDown={onTitlePointerDown}
        >
          <div className="pane-window__traffic" role="group" aria-label={title}>
            <button
              type="button"
              className="pane-window__traffic-btn pane-window__traffic-btn--close"
              title={closeLabel}
              aria-label={closeLabel}
              onClick={event => {
                event.stopPropagation()
                onClose()
              }}
              onPointerDown={event => event.stopPropagation()}
            />
            <button
              type="button"
              className="pane-window__traffic-btn pane-window__traffic-btn--min"
              title={closeLabel}
              aria-label={closeLabel}
              onClick={event => {
                event.stopPropagation()
                if (isMini && !zooming) return
                onClose()
              }}
              onPointerDown={event => event.stopPropagation()}
            />
            <button
              type="button"
              className="pane-window__traffic-btn pane-window__traffic-btn--zoom"
              title={isMini ? maximizeLabel : (isFullscreen ? restoreLabel : maximizeLabel)}
              aria-label={isMini ? maximizeLabel : (isFullscreen ? restoreLabel : maximizeLabel)}
              onClick={event => {
                event.stopPropagation()
                if (zooming) return
                if (isMini) {
                  onExpand?.()
                } else {
                  onToggleFullscreen?.()
                }
              }}
              onPointerDown={event => event.stopPropagation()}
            />
          </div>
          {onRename && !isMini && renameDraft !== null ? (
            <input
              className="pane-window__title-input"
              value={renameDraft}
              aria-label={renameLabel}
              autoFocus
              spellCheck={false}
              maxLength={MAX_PANE_TITLE_LENGTH}
              onChange={event => setRenameDraft(event.target.value)}
              onFocus={event => event.currentTarget.select()}
              onBlur={() => {
                onRename(renameDraft)
                setRenameDraft(null)
              }}
              onKeyDown={event => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  onRename(renameDraft)
                  setRenameDraft(null)
                }
                if (event.key === 'Escape') {
                  event.preventDefault()
                  setRenameDraft(null)
                }
              }}
              // El header arrastra la ventana: el input se queda los eventos.
              onPointerDown={event => event.stopPropagation()}
            />
          ) : (
            <h2
              className={[
                'pane-window__title',
                onRename && !isMini ? 'pane-window__title--editable' : '',
              ].filter(Boolean).join(' ')}
              title={onRename && !isMini ? renameLabel : undefined}
              onDoubleClick={onRename && !isMini
                ? () => setRenameDraft(title)
                : undefined}
            >
              {title}
            </h2>
          )}
          {busy && <PlaneBusyDot />}
          {!isMini && onConfigure && configureLabel ? (
            <div className="pane-window__actions">
              <button
                type="button"
                className="pane-window__action"
                title={configureLabel}
                aria-label={configureLabel}
                onClick={e => {
                  e.stopPropagation()
                  onConfigure()
                }}
                onPointerDown={e => e.stopPropagation()}
              >
                <Icon name="settings" size={12} />
              </button>
            </div>
          ) : null}
        </header>
        )}
        <div
          className="pane-window__body"
          onPointerDown={showAsMini ? onBodyPointerDown : undefined}
        >
          {showAsMini && !miniLivePreview && miniFace}
          <div
            className={[
              'pane-window__live-host',
              `pane-window__live-host--${liveHostMode}`,
            ].filter(Boolean).join(' ')}
            style={miniLivePreview && (showAsMini || zooming)
              ? {
                  // PTY a tamaño full estable (el scale lo hace shell/root).
                  width: parkBodyW,
                  height: parkBodyH,
                  flex: 'none',
                }
              : showAsMini && !miniLivePreview
                ? {
                    width: parkWidth,
                    height: parkHeight,
                  }
                : undefined}
            aria-hidden={showAsMini && !miniLivePreview}
          >
            {children}
          </div>
        </div>
      </div>
      </div>
    </div>
  )
}
