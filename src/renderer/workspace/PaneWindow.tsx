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
import { isMiniExpandSuppressed } from './miniExpandSuppress'
import {
  hasPlaneContextDrag,
  readPlaneContextDragData,
} from './planeContextDrag'
import './PaneWindow.css'

export type PaneWindowDisplay = 'mini' | 'full'

export type PaneWindowLayoutGeometry = PaneWindowGeometry & {
  zIndex: number
  fullscreen: boolean
}

const PANE_ZOOM_MS = 300

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
  /** Drop de un contexto del pool sobre este pane (agentes). */
  onDropContext?: (contextId: string) => void
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
  onDropContext,
}) => {
  const isMini = display === 'mini'
  const isFullscreen = !isMini && geometry.fullscreen
  const prevDisplayRef = useRef(display)
  const [contextDropActive, setContextDropActive] = useState(false)
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
  // Titlebar visible en zoom aunque el mini no lleve chrome (evita cortes).
  const titlebarVisible = showTitlebar || zooming
  // Misma altura mini/full: el host live debe medir igual que el body expandido
  // (si mini usa sizeW×sizeH, al abrir el body es más bajo → fit + scrollToBottom).
  const chromeH = showTitlebar ? PLANE_MINI_TITLEBAR_HEIGHT : 0
  const parkBodyW = sizeW
  const parkBodyH = Math.max(1, sizeH - chromeH)
  const miniTitlebarH = showAsMini && titlebarVisible ? PLANE_MINI_TITLEBAR_HEIGHT : 0
  const previewBodyW = miniW
  const previewBodyH = Math.max(1, miniH - miniTitlebarH)
  /** Terminal mini: escala cover del body full dentro de la ranura (sin cambiar cols/rows). */
  const liveCoverScale = Math.max(
    previewBodyW / Math.max(parkBodyW, 1),
    previewBodyH / Math.max(parkBodyH, 1),
  )
  const liveOffsetX = (previewBodyW - parkBodyW * liveCoverScale) / 2
  const liveOffsetY = (previewBodyH - parkBodyH * liveCoverScale) / 2

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
    height: miniH,
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

  const stageEase = `${PANE_ZOOM_MS}ms cubic-bezier(0.05, 0.9, 0.08, 1)`
  // Terminales live: nunca animar width/height (el fit intermedio hace saltar el texto).
  // Agentes: transición CSS de caja.
  const stageTransition = motionReady && !zooming && !miniLivePreview
    ? `left ${stageEase}, top ${stageEase}, width ${stageEase}, height ${stageEase}, box-shadow ${PANE_ZOOM_MS}ms ease`
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
  }, [display, miniH, miniW, miniAgentCard])

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

  // Misma caja/sombra mini en reposo y busy (sin glow; el borde cromático es CSS).
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
        contextDropActive ? 'pane-window--context-drop' : '',
      ].filter(Boolean).join(' ')}
      style={{
        left: layout.left,
        top: layout.top,
        width: layout.width,
        height: layout.height,
        zIndex: zooming || (!isMini && !isFullscreen)
          ? Math.max(Number(layout.zIndex) || 0, 120)
          : layout.zIndex,
        ...(stageTransition ? { transition: stageTransition } : null),
        ...(agentParkedShadow ? { boxShadow: agentParkedShadow } : null),
      }}
      onMouseDown={event => {
        onFocus()
        event.stopPropagation()
      }}
      onDragOver={onDropContext ? onContextDragOver : undefined}
      onDragLeave={onDropContext ? onContextDragLeave : undefined}
      onDrop={onDropContext ? onContextDrop : undefined}
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
              showAsMini && miniLivePreview ? 'pane-window__live-host--mini-cover' : '',
            ].filter(Boolean).join(' ')}
            style={showAsMini && miniLivePreview
              ? {
                  width: parkBodyW,
                  height: parkBodyH,
                  transformOrigin: 'top left',
                  transform: `translate(${liveOffsetX}px, ${liveOffsetY}px) scale(${liveCoverScale})`,
                }
              : zooming && miniLivePreview
                ? {
                    // Mismo tamaño de body durante el morph (evita un fit al quitar el cover).
                    width: parkBodyW,
                    height: parkBodyH,
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
  )
}
