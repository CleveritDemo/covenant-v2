import React, { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { isReduceMotionActive } from '../reduceMotion'
import { stepPlaneEnergy } from './planeEnergyEnvelope'
import {
  mountPlaneSpacetimeGrid,
  readSpacetimeGridConfig,
  type PlaneSpacetimeGridRuntime,
} from './planeSpacetimeGridScene'
import { drawSphericalGrid, readSphericalGridTheme } from './planeSphericalGridDraw'
import './PlaneMapSphericalGrid.css'

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

/** Rejilla 3D del plano (Three.js): interior de esfera vista desde el centro. */
export const PlaneMapSphericalGrid: React.FC<PlaneMapSphericalGridProps> = ({
  energyTarget = 0,
}) => {
  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const runtimeRef = useRef<PlaneSpacetimeGridRuntime | null>(null)
  const reducedMotion = usePrefersReducedMotion()
  const [webglReady, setWebglReady] = useState(false)
  // Ref y no dependencia: cambiar la energía no debe remontar la escena.
  const energyTargetRef = useRef(energyTarget)
  const energyRef = useRef(0)

  useEffect(() => {
    energyTargetRef.current = energyTarget
  }, [energyTarget])

  // Reduce motion: misma esfera, pintada una vez en canvas 2D y sin animación.
  useLayoutEffect(() => {
    if (!reducedMotion) return undefined
    const wrap = wrapRef.current
    const canvas = canvasRef.current
    if (!wrap || !canvas) return undefined

    const paint = (): void => {
      const rect = wrap.getBoundingClientRect()
      if (rect.width <= 0 || rect.height <= 0) {
        setWebglReady(false)
        return
      }
      const ratio = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = Math.round(rect.width * ratio)
      canvas.height = Math.round(rect.height * ratio)
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        setWebglReady(false)
        return
      }
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0)
      drawSphericalGrid(ctx, rect.width, rect.height, readSphericalGridTheme(wrap))
      setWebglReady(true)
    }

    const resizeObserver = new ResizeObserver(paint)
    resizeObserver.observe(wrap)
    const themeObserver = new MutationObserver(paint)
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme', 'data-theme-appearance', 'style'],
    })
    paint()

    return () => {
      resizeObserver.disconnect()
      themeObserver.disconnect()
      setWebglReady(false)
    }
  }, [reducedMotion])

  useLayoutEffect(() => {
    if (reducedMotion) {
      runtimeRef.current?.dispose()
      runtimeRef.current = null
      return undefined
    }

    const wrap = wrapRef.current
    const canvas = canvasRef.current
    if (!wrap || !canvas) return undefined

    let raf = 0
    let running = true
    let lastFrameMs = -1

    const syncSize = (): boolean => {
      const rect = wrap.getBoundingClientRect()
      if (rect.width <= 0 || rect.height <= 0) {
        setWebglReady(false)
        return false
      }

      if (!runtimeRef.current) {
        runtimeRef.current = mountPlaneSpacetimeGrid(
          canvas,
          rect.width,
          rect.height,
          readSpacetimeGridConfig(wrap, true),
        )
      } else {
        runtimeRef.current.resize(rect.width, rect.height)
        runtimeRef.current.updateConfig(readSpacetimeGridConfig(wrap, true))
      }

      setWebglReady(true)
      return true
    }

    const frame = (time: number): void => {
      if (!running) return
      const dtReal = lastFrameMs < 0
        ? 0
        : Math.max(0, Math.min(0.25, (time - lastFrameMs) / 1000))
      lastFrameMs = time
      const runtime = runtimeRef.current
      if (runtime && syncSize()) {
        energyRef.current = stepPlaneEnergy(
          energyRef.current,
          energyTargetRef.current,
          dtReal,
        )
        runtime.setEnergy(energyRef.current)
        runtime.render(time)
      }
      raf = window.requestAnimationFrame(frame)
    }

    const resizeObserver = new ResizeObserver(() => {
      syncSize()
    })
    resizeObserver.observe(wrap)

    const themeObserver = new MutationObserver(() => {
      const runtime = runtimeRef.current
      if (!runtime || !wrap) return
      runtime.updateConfig(readSpacetimeGridConfig(wrap, true))
    })
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme', 'data-theme-appearance', 'style'],
    })

    const onVisibility = (): void => {
      if (document.visibilityState === 'visible') syncSize()
    }
    document.addEventListener('visibilitychange', onVisibility)

    syncSize()
    raf = window.requestAnimationFrame(frame)

    return () => {
      running = false
      window.cancelAnimationFrame(raf)
      resizeObserver.disconnect()
      themeObserver.disconnect()
      document.removeEventListener('visibilitychange', onVisibility)
      runtimeRef.current?.dispose()
      runtimeRef.current = null
      setWebglReady(false)
    }
  }, [reducedMotion])

  return (
    <div
      ref={wrapRef}
      className={[
        'plane-map__grid',
        'plane-map__grid--spherical',
        reducedMotion ? 'plane-map__grid--static' : '',
        webglReady ? 'plane-map__grid--canvas-ready' : '',
      ].filter(Boolean).join(' ')}
      aria-hidden="true"
    >
      <canvas ref={canvasRef} className="plane-map__grid-canvas" />
    </div>
  )
}
