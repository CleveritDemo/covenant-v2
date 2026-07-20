import React, { useCallback, useLayoutEffect, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { Icon } from '../components/ui/Icon'
import {
  PANE_WINDOW_MIN_HEIGHT,
  PANE_WINDOW_MIN_WIDTH,
  PLANE_MINI_AGENT_HEIGHT,
  PLANE_MINI_AGENT_WIDTH,
  PLANE_MINI_WINDOW_HEIGHT,
  PLANE_MINI_WINDOW_WIDTH,
  type PaneWindowGeometry,
} from '@shared/paneWindows'
import { isMiniExpandSuppressed } from './miniExpandSuppress'
import './PaneWindow.css'

export type PaneWindowDisplay = 'mini' | 'full'

export type PaneWindowLayoutGeometry = PaneWindowGeometry & {
  zIndex: number
  fullscreen: boolean
}

const PANE_ZOOM_MS = 300

/**
 * Misma sombra local que las terminales en CSS; en agentes se multiplica por
 * parkScale de la terminal (ellas la encogen con scale; los agentes no).
 */
const MINI_SHADOW = {
  x: 5,
  y: 6,
  blur: 18,
  alpha: 0.16,
  x2: 1,
  y2: 2,
  blur2: 5,
  alpha2: 0.08,
} as const

/** Park mini↔full: translate + scale uniforme (letterbox en la ranura). */
function parkTransform(options: {
  parked: boolean
  dx: number
  dy: number
  scale: number
}): string {
  const s = options.parked ? options.scale : 1
  const dx = options.parked ? options.dx : 0
  const dy = options.parked ? options.dy : 0
  return `translate(${dx}px, ${dy}px) scale(${s})`
}

function agentMiniBoxShadow(screenMul: number): string {
  const m = Math.max(screenMul, 0.001)
  const a = MINI_SHADOW
  return [
    `${a.x * m}px ${a.y * m}px ${a.blur * m}px color-mix(in srgb, #000 ${a.alpha * 100}%, transparent)`,
    `${a.x2 * m}px ${a.y2 * m}px ${a.blur2 * m}px color-mix(in srgb, #000 ${a.alpha2 * 100}%, transparent)`,
    'inset 0 0 0 1px var(--plane-highlight)',
  ].join(', ')
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
  return typeof window !== 'undefined'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function readOffsetParentSize(el: HTMLElement | null): { w: number; h: number } | null {
  const parent = el?.offsetParent
  if (!(parent instanceof HTMLElement)) return null
  const w = parent.clientWidth
  const h = parent.clientHeight
  if (w <= 0 || h <= 0) return null
  return { w, h }
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

  let finished = false
  flushSync(() => {
    setZoomMode(mode)
    setZoomPrep(true)
    setLayoutOverride(layout)
  })

  const node = root
  if (!node) {
    onFinished()
    flushSync(() => {
      setLayoutOverride(null)
      setZoomMode('idle')
      setZoomPrep(false)
    })
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
      anim.cancel()
    } catch { /* ignore */ }
    node.style.transform = ''
    node.style.transition = ''
    node.style.transformOrigin = ''
    onFinished()
    flushSync(() => {
      setLayoutOverride(null)
      setZoomMode('idle')
      setZoomPrep(false)
    })
  }

  anim.addEventListener('finish', finish)
  const timer = window.setTimeout(finish, PANE_ZOOM_MS + 64)
  return () => {
    finished = true
    window.clearTimeout(timer)
    try {
      anim.cancel()
    } catch { /* ignore */ }
    node.style.transform = ''
    node.style.transition = ''
    node.style.transformOrigin = ''
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
  maximizeLabel: string
  restoreLabel: string
  closeLabel: string
  configureLabel?: string
  onConfigure?: () => void
  miniFace?: React.ReactNode
  miniActions?: React.ReactNode
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
}

export const PaneWindow: React.FC<PaneWindowProps> = ({
  title,
  display,
  geometry,
  miniOrigin,
  focused = false,
  busy = false,
  maximizeLabel,
  restoreLabel,
  closeLabel,
  configureLabel,
  onConfigure,
  miniFace,
  miniActions,
  miniLivePreview = false,
  miniAgentCard = false,
  showTitlebar = true,
  children,
  onExpand,
  onToggleFullscreen,
  onClose,
  onFocus,
}) => {
  const isMini = display === 'mini'
  const isFullscreen = !isMini && geometry.fullscreen
  const prevDisplayRef = useRef(display)
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
  // Agentes: tamaño del contenedor = footprint letterbox de terminal (vía miniOrigin).
  const miniW = miniAgentCard
    ? (miniOrigin.width ?? PLANE_MINI_AGENT_WIDTH)
    : PLANE_MINI_WINDOW_WIDTH
  const miniH = miniAgentCard
    ? (miniOrigin.height ?? PLANE_MINI_AGENT_HEIGHT)
    : PLANE_MINI_WINDOW_HEIGHT

  /** Terminales: caja SIEMPRE geometry (~70%). Mini = scale uniforme (letterbox). */
  const stableGeometry = miniLivePreview
  const parkScale = Math.min(
    miniW / Math.max(sizeW, 1),
    miniH / Math.max(sizeH, 1),
  )
  const scaledW = sizeW * parkScale
  const scaledH = sizeH * parkScale
  const targetX = miniOrigin.x + (miniW - scaledW) / 2
  const targetY = miniOrigin.y + (miniH - scaledH) / 2
  const parkDx = targetX - (geometry.x + (sizeW - scaledW) / 2)
  const parkDy = targetY - (geometry.y + (sizeH - scaledH) / 2)

  const zooming = zoomMode !== 'idle'
  const showAsMini = isMini && !zooming

  const fullLayout: LayoutBox = {
    left: geometry.x,
    top: geometry.y,
    width: sizeW,
    height: sizeH,
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
    : stableGeometry || !showAsMini
      ? fullLayout
      : {
          left: miniOrigin.x,
          top: miniOrigin.y,
          width: miniW,
          height: miniH,
          zIndex: geometry.zIndex,
        }

  const layout = layoutOverride ?? targetLayout

  const [motionReady, setMotionReady] = useState(false)
  useLayoutEffect(() => {
    const id = window.requestAnimationFrame(() => setMotionReady(true))
    return () => window.cancelAnimationFrame(id)
  }, [])

  const rootTransform = (() => {
    if (zooming || isFullscreen) return undefined
    if (stableGeometry) {
      return parkTransform({
        parked: isMini,
        dx: parkDx,
        dy: parkDy,
        scale: parkScale,
      })
    }
    return undefined
  })()

  const stageEase = `${PANE_ZOOM_MS}ms cubic-bezier(0.05, 0.9, 0.08, 1)`
  const stageTransition = motionReady && !zooming
    ? (
      stableGeometry
        ? `transform ${stageEase}, box-shadow ${PANE_ZOOM_MS}ms ease`
        : `left ${stageEase}, top ${stageEase}, width ${stageEase}, height ${stageEase}, box-shadow ${PANE_ZOOM_MS}ms ease`
    )
    : undefined

  useLayoutEffect(() => {
    const prev = prevDisplayRef.current
    if (prev === display) return

    const geo = geometryRef.current
    const origin = miniOriginRef.current
    const zoomZ = Math.max(geo.zIndex, 120)
    const miniBox: RectBox = { x: origin.x, y: origin.y, w: miniW, h: miniH }
    const sx = miniBox.w / Math.max(geo.width, 1)
    const sy = miniBox.h / Math.max(geo.height, 1)
    const dx = miniBox.x - geo.x
    const dy = miniBox.y - geo.y
    const parked = `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`
    const identity = 'translate(0px, 0px) scale(1, 1)'

    const resetZoom = (): void => {
      setLayoutOverride(null)
      setZoomMode('idle')
      setZoomPrep(false)
    }

    const commitDisplay = (): void => {
      prevDisplayRef.current = display
    }

    // Mini↔centro: transición CSS del transform inline (terminals + agents).
    if (!geo.fullscreen && (stableGeometry || miniAgentCard)) {
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
        zIndex: zoomZ,
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
          zIndex: zoomZ,
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
  }, [display, miniH, miniW, stableGeometry, miniAgentCard])

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
    // Expandir en pointerdown (no esperar al click/mouseup → se siente con delay).
    event.preventDefault()
    onExpand?.()
  }, [isMini, onExpand, onFocus])

  const onBodyPointerDown = useCallback((event: React.PointerEvent) => {
    if (!isMini || event.button !== 0) return
    if (isMiniExpandSuppressed()) return
    if ((event.target as HTMLElement | null)?.closest?.('button, a, input, select, textarea, [role="button"]')) {
      return
    }
    event.preventDefault()
    onFocus()
    onExpand?.()
  }, [isMini, onExpand, onFocus])

  const parkWidth = Math.max(PANE_WINDOW_MIN_WIDTH, geometry.width)
  const parkHeight = Math.max(PANE_WINDOW_MIN_HEIGHT, geometry.height)
  // Titlebar visible en zoom aunque el mini no lleve chrome (evita cortes).
  const titlebarVisible = showTitlebar || zooming

  // Terminales: host siempre activo (mismo tamaño). Agentes mini: aparcados + face.
  const liveHostMode = (!isMini || zooming || miniLivePreview)
    ? 'active'
    : 'parked'

  // Agentes: sombra = la de terminales ya “encogida” por parkScale (terminales no se tocan).
  const terminalParkScale = Math.min(
    PLANE_MINI_WINDOW_WIDTH / Math.max(sizeW, 1),
    PLANE_MINI_WINDOW_HEIGHT / Math.max(sizeH, 1),
  )
  const agentParkedShadow = showAsMini && miniAgentCard && !isFullscreen
    ? agentMiniBoxShadow(terminalParkScale)
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
        stableGeometry ? 'pane-window--stable-geometry' : '',
        focused ? 'pane-window--focused' : '',
        busy ? 'pane-window--busy' : '',
      ].filter(Boolean).join(' ')}
      style={{
        left: layout.left,
        top: layout.top,
        width: layout.width,
        height: layout.height,
        zIndex: zooming || (!isMini && !isFullscreen)
          ? Math.max(Number(layout.zIndex) || 0, 120)
          : layout.zIndex,
        ...(rootTransform != null ? {
          transform: rootTransform,
          transformOrigin: 'center center',
        } : null),
        ...(stageTransition ? { transition: stageTransition } : null),
        ...(agentParkedShadow ? { boxShadow: agentParkedShadow } : null),
      }}
      onMouseDown={event => {
        onFocus()
        event.stopPropagation()
      }}
    >
      <div className="pane-window__shell">
        {showAsMini && miniActions}
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
              disabled={isMini || zooming}
              onClick={event => {
                event.stopPropagation()
                onClose()
              }}
              onPointerDown={event => event.stopPropagation()}
            />
            <button
              type="button"
              className="pane-window__traffic-btn pane-window__traffic-btn--zoom"
              title={isMini ? maximizeLabel : (isFullscreen ? restoreLabel : maximizeLabel)}
              aria-label={isMini ? maximizeLabel : (isFullscreen ? restoreLabel : maximizeLabel)}
              disabled={zooming}
              onClick={event => {
                event.stopPropagation()
                if (isMini) {
                  onExpand?.()
                } else {
                  onToggleFullscreen?.()
                }
              }}
              onPointerDown={event => event.stopPropagation()}
            />
          </div>
          <h2 className="pane-window__title">{title}</h2>
          {busy && <span className="pane-window__busy-dot" aria-hidden="true" />}
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
            ].join(' ')}
            style={showAsMini && !miniLivePreview ? {
              width: parkWidth,
              height: parkHeight,
            } : undefined}
            aria-hidden={showAsMini && !miniLivePreview}
          >
            {children}
          </div>
        </div>
      </div>
    </div>
  )
}
