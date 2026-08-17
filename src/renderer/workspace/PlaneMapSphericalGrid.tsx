import React, { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { isReduceMotionActive } from '../reduceMotion'
import { stepPlaneEnergy } from './planeEnergyEnvelope'
import { energizedOpacityFactor } from './planeSpacetimeGridScene'
import {
  drawSphericalGrid,
  planeGridPointerLerpAlpha,
  readSphericalGridTheme,
} from './planeSphericalGridDraw'
import './PlaneMapSphericalGrid.css'

/** Desplazamiento máximo del wrap por parallax (px CSS). */
const PARALLAX_SHIFT_PX = 40
/** Tau NDC: más bajo = sigue el mouse más de cerca. */
const PARALLAX_NDC_TAU_S = 0.12
/** Tau shift CSS: lag suave sobre el NDC. */
const PARALLAX_LOOK_TAU_S = 0.2
/** Tope de updates de transform (~30fps) para no saturar el compositor. */
const PARALLAX_MIN_FRAME_MS = 33
const ENERGY_PAINT_EPS = 0.012
const SETTLE_EPS = 0.0008

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() => isReduceMotionActive())
  useLayoutEffect(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return undefined
    const sync = (): void => setReduced(isReduceMotionActive())
    const mq = typeof window.matchMedia === 'function'
      ? window.matchMedia('(prefers-reduced-motion: reduce)')
      : null
    mq?.addEventListener('change', sync)
    const observer = new MutationObserver(sync)
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-reduce-motion'],
    })
    sync()
    return () => {
      mq?.removeEventListener('change', sync)
      observer.disconnect()
    }
  }, [])
  return reduced
}

type PlaneMapSphericalGridProps = {
  /** Energía objetivo del plano 0..1 (agentes busy); se suaviza en el rAF. */
  energyTarget?: number
}

/**
 * Rejilla esférica canvas 2D, look fijo +Z.
 * Parallax = translate CSS en el wrap (no reproyecta). El pointermove solo
 * guarda clientX/Y; el rAF aplica el shift con rect cacheado y tope ~20fps.
 */
export const PlaneMapSphericalGrid: React.FC<PlaneMapSphericalGridProps> = ({
  energyTarget = 0,
}) => {
  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const reducedMotion = usePrefersReducedMotion()
  const [canvasReady, setCanvasReady] = useState(false)
  const energyTargetRef = useRef(energyTarget)
  const energyRef = useRef(0)
  const lastPaintedEnergyRef = useRef(-1)
  const wakeAnimRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    energyTargetRef.current = energyTarget
    wakeAnimRef.current?.()
  }, [energyTarget])

  useLayoutEffect(() => {
    const wrap = wrapRef.current
    const canvas = canvasRef.current
    if (!wrap || !canvas) return undefined

    const allowParallax = !reducedMotion
    let raf = 0
    let running = true
    let animating = false
    let lastFrameMs = -1
    let lastParallaxApplyMs = 0
    let dirty = true
    let canvasReadySent = false
    let lastCssW = 0
    let lastCssH = 0
    let lastRatio = 0
    let rectLeft = 0
    let rectTop = 0
    let rectW = 0
    let rectH = 0
    let pointerClientX = rectW > 0 ? rectLeft + rectW / 2 : 0
    let pointerClientY = rectH > 0 ? rectTop + rectH / 2 : 0
    const ndc = { x: 0, y: 0 }
    const shift = { x: 0, y: 0 }
    let appliedX = 0
    let appliedY = 0

    const refreshRectCache = (): boolean => {
      const rect = wrap.getBoundingClientRect()
      if (rect.width <= 0 || rect.height <= 0) {
        rectW = 0
        rectH = 0
        return false
      }
      rectLeft = rect.left
      rectTop = rect.top
      rectW = rect.width
      rectH = rect.height
      return true
    }

    const applyShiftIfChanged = (x: number, y: number): void => {
      const qx = Math.round(x * 4) / 4
      const qy = Math.round(y * 4) / 4
      if (qx === appliedX && qy === appliedY) return
      appliedX = qx
      appliedY = qy
      wrap.style.setProperty('--plane-grid-shift-x', `${qx}px`)
      wrap.style.setProperty('--plane-grid-shift-y', `${qy}px`)
    }

    const paintSphere = (force = false): boolean => {
      if (!refreshRectCache()) {
        if (canvasReadySent) {
          canvasReadySent = false
          setCanvasReady(false)
        }
        return false
      }

      const ratio = Math.min(window.devicePixelRatio || 1, 2)
      const cssW = rectW
      const cssH = rectH
      const pxW = Math.round(cssW * ratio)
      const pxH = Math.round(cssH * ratio)
      if (
        force
        || cssW !== lastCssW
        || cssH !== lastCssH
        || ratio !== lastRatio
        || canvas.width !== pxW
        || canvas.height !== pxH
      ) {
        canvas.width = pxW
        canvas.height = pxH
        lastCssW = cssW
        lastCssH = cssH
        lastRatio = ratio
      }

      const ctx = canvas.getContext('2d')
      if (!ctx) {
        if (canvasReadySent) {
          canvasReadySent = false
          setCanvasReady(false)
        }
        return false
      }
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0)

      const theme = readSphericalGridTheme(wrap)
      const lineAlpha = (theme.lineAlpha ?? 1) * energizedOpacityFactor(energyRef.current)
      drawSphericalGrid(ctx, cssW, cssH, {
        ...theme,
        lineAlpha,
        lookDir: [0, 0, 1],
      })
      lastPaintedEnergyRef.current = energyRef.current
      if (!canvasReadySent) {
        canvasReadySent = true
        setCanvasReady(true)
      }
      dirty = false
      return true
    }

    const stillSettling = (): boolean => {
      if (Math.abs(energyRef.current - energyTargetRef.current) > SETTLE_EPS) return true
      if (!allowParallax) return false
      if (rectW <= 0 || rectH <= 0) return false
      const rawX = Math.min(1, Math.max(-1, ((pointerClientX - rectLeft) / rectW) * 2 - 1))
      const rawY = Math.min(1, Math.max(-1, -(((pointerClientY - rectTop) / rectH) * 2 - 1)))
      if (Math.hypot(rawX - ndc.x, rawY - ndc.y) > SETTLE_EPS) return true
      const tx = -ndc.x * PARALLAX_SHIFT_PX
      const ty = ndc.y * PARALLAX_SHIFT_PX
      return Math.hypot(tx - shift.x, ty - shift.y) > 0.08
    }

    const frame = (time: number): void => {
      if (!running) return
      const dtReal = lastFrameMs < 0
        ? 0
        : Math.max(0, Math.min(0.25, (time - lastFrameMs) / 1000))
      lastFrameMs = time

      energyRef.current = stepPlaneEnergy(
        energyRef.current,
        energyTargetRef.current,
        dtReal,
      )

      if (allowParallax && rectW > 0 && rectH > 0) {
        const rawX = Math.min(1, Math.max(-1, ((pointerClientX - rectLeft) / rectW) * 2 - 1))
        const rawY = Math.min(1, Math.max(-1, -(((pointerClientY - rectTop) / rectH) * 2 - 1)))
        const ndcAlpha = planeGridPointerLerpAlpha(dtReal, PARALLAX_NDC_TAU_S)
        ndc.x += (rawX - ndc.x) * ndcAlpha
        ndc.y += (rawY - ndc.y) * ndcAlpha
        const targetX = -ndc.x * PARALLAX_SHIFT_PX
        const targetY = ndc.y * PARALLAX_SHIFT_PX
        const shiftAlpha = planeGridPointerLerpAlpha(dtReal, PARALLAX_LOOK_TAU_S)
        shift.x += (targetX - shift.x) * shiftAlpha
        shift.y += (targetY - shift.y) * shiftAlpha
        if (time - lastParallaxApplyMs >= PARALLAX_MIN_FRAME_MS) {
          lastParallaxApplyMs = time
          applyShiftIfChanged(shift.x, shift.y)
        }
      }

      const energyMoved = Math.abs(energyRef.current - lastPaintedEnergyRef.current) > ENERGY_PAINT_EPS
      if (dirty || energyMoved) {
        paintSphere(dirty)
      }

      if (dirty || stillSettling()) {
        raf = window.requestAnimationFrame(frame)
      } else {
        applyShiftIfChanged(shift.x, shift.y)
        animating = false
        lastFrameMs = -1
        raf = 0
      }
    }

    const ensureAnimating = (): void => {
      if (!running || animating) return
      animating = true
      lastFrameMs = -1
      raf = window.requestAnimationFrame(frame)
    }

    wakeAnimRef.current = () => {
      dirty = true
      ensureAnimating()
    }

    const markDirty = (): void => {
      dirty = true
      refreshRectCache()
      if (reducedMotion) {
        energyRef.current = energyTargetRef.current
        applyShiftIfChanged(0, 0)
        paintSphere(true)
        return
      }
      ensureAnimating()
    }

    const resizeObserver = new ResizeObserver(markDirty)
    resizeObserver.observe(wrap)

    const themeObserver = new MutationObserver(markDirty)
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme', 'data-theme-appearance', 'style'],
    })

    const onVisibility = (): void => {
      if (document.visibilityState === 'visible') markDirty()
    }
    document.addEventListener('visibilitychange', onVisibility)

    const onScroll = (): void => {
      refreshRectCache()
    }
    window.addEventListener('scroll', onScroll, true)

    // Solo coordenadas: nada de layout ni paint en el hot path del mouse.
    const onPointerMove = (event: PointerEvent): void => {
      if (!allowParallax) return
      pointerClientX = event.clientX
      pointerClientY = event.clientY
      ensureAnimating()
    }

    refreshRectCache()
    if (rectW > 0) {
      pointerClientX = rectLeft + rectW / 2
      pointerClientY = rectTop + rectH / 2
    }
    applyShiftIfChanged(0, 0)
    paintSphere(true)

    if (allowParallax) {
      window.addEventListener('pointermove', onPointerMove, { passive: true })
      if (stillSettling()) ensureAnimating()
    }

    return () => {
      running = false
      wakeAnimRef.current = null
      window.cancelAnimationFrame(raf)
      resizeObserver.disconnect()
      themeObserver.disconnect()
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('pointermove', onPointerMove)
      wrap.style.removeProperty('--plane-grid-shift-x')
      wrap.style.removeProperty('--plane-grid-shift-y')
      setCanvasReady(false)
    }
  }, [reducedMotion])

  useEffect(() => {
    if (!reducedMotion) return
    energyRef.current = energyTarget
    lastPaintedEnergyRef.current = energyTarget
    const wrap = wrapRef.current
    const canvas = canvasRef.current
    if (!wrap || !canvas) return
    wrap.style.removeProperty('--plane-grid-shift-x')
    wrap.style.removeProperty('--plane-grid-shift-y')
    const rect = wrap.getBoundingClientRect()
    if (rect.width <= 0 || rect.height <= 0) return
    const ratio = Math.min(window.devicePixelRatio || 1, 2)
    canvas.width = Math.round(rect.width * ratio)
    canvas.height = Math.round(rect.height * ratio)
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0)
    const theme = readSphericalGridTheme(wrap)
    const lineAlpha = (theme.lineAlpha ?? 1) * energizedOpacityFactor(energyTarget)
    drawSphericalGrid(ctx, rect.width, rect.height, {
      ...theme,
      lineAlpha,
      lookDir: [0, 0, 1],
    })
  }, [reducedMotion, energyTarget])

  return (
    <div
      ref={wrapRef}
      className={[
        'plane-map__grid',
        'plane-map__grid--spherical',
        reducedMotion ? 'plane-map__grid--static' : '',
        canvasReady ? 'plane-map__grid--canvas-ready' : '',
      ].filter(Boolean).join(' ')}
      aria-hidden="true"
    >
      <canvas ref={canvasRef} className="plane-map__grid-canvas" />
    </div>
  )
}
