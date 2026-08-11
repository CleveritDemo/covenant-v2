import React, { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { isReduceMotionActive } from '../reduceMotion'
import './PlaneMapGridParticles.css'

type Particle = {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  maxLife: number
  size: number
  color: string
}

const COLOR_VARS = [
  '--accent',
  '--theme-cyan',
  '--theme-magenta',
  '--theme-blue',
  '--plane-grid-line',
] as const

const MIN_PARTICLES = 12
const MAX_PARTICLES = 24
/** Pico de opacidad — sutil, no compite con paneles. */
const ALPHA_PEAK = 0.14
/** Drift máximo en CSS px/s (lento). */
const DRIFT_MAX = 6

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() => isReduceMotionActive())
  useLayoutEffect(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return
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

function readThemeColors(el: Element): string[] {
  const styles = getComputedStyle(el)
  const colors: string[] = []
  for (const name of COLOR_VARS) {
    const value = styles.getPropertyValue(name).trim()
    if (value) colors.push(value)
  }
  return colors.length > 0 ? colors : ['rgba(120, 180, 255, 0.35)']
}

function spawnParticle(width: number, height: number, colors: string[]): Particle {
  const maxLife = 4 + Math.random() * 6
  return {
    x: Math.random() * width,
    y: Math.random() * height,
    vx: (Math.random() - 0.5) * DRIFT_MAX * 2,
    vy: (Math.random() - 0.5) * DRIFT_MAX * 2,
    life: Math.random() * maxLife,
    maxLife,
    size: 0.6 + Math.random() * 1.4,
    color: colors[Math.floor(Math.random() * colors.length)]!,
  }
}

function drawParticle(ctx: CanvasRenderingContext2D, p: Particle): void {
  const lifeRatio = Math.min(1, Math.max(0, p.life / p.maxLife))
  const fade = Math.sin(lifeRatio * Math.PI)
  const alpha = Math.max(0, fade * ALPHA_PEAK)
  if (alpha < 0.01) return

  const radius = p.size
  if (radius < 0.15) return

  const gradient = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, radius * 2.2)
  gradient.addColorStop(0, p.color)
  gradient.addColorStop(0.5, p.color)
  gradient.addColorStop(1, 'transparent')

  ctx.globalAlpha = alpha
  ctx.fillStyle = gradient
  ctx.beginPath()
  ctx.arc(p.x, p.y, radius * 2.2, 0, Math.PI * 2)
  ctx.fill()
}

/** Partículas ambientales lentas sobre la cuadrícula del PlaneMap (solo con motion). */
export const PlaneMapGridParticles: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const reducedMotion = usePrefersReducedMotion()
  const shouldRun = !reducedMotion

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !shouldRun) {
      if (canvas) {
        const ctx = canvas.getContext('2d')
        if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height)
      }
      return
    }

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let rafId = 0
    let running = true
    let lastTs = 0
    const particles: Particle[] = []
    let colors = readThemeColors(canvas)
    let cssW = 1
    let cssH = 1

    const resize = (): void => {
      const parent = canvas.parentElement
      const w = Math.max(1, Math.floor(parent?.clientWidth ?? canvas.clientWidth))
      const h = Math.max(1, Math.floor(parent?.clientHeight ?? canvas.clientHeight))
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = Math.floor(w * dpr)
      canvas.height = Math.floor(h * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      cssW = w
      cssH = h
      colors = readThemeColors(canvas)
    }

    resize()

    const count = MIN_PARTICLES
      + Math.floor(Math.random() * (MAX_PARTICLES - MIN_PARTICLES + 1))
    for (let i = 0; i < count; i += 1) {
      particles.push(spawnParticle(cssW, cssH, colors))
    }

    const ro = typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(resize)
      : null
    if (ro && canvas.parentElement) ro.observe(canvas.parentElement)
    window.addEventListener('resize', resize)

    const tick = (ts: number): void => {
      if (!running) return
      if (!lastTs) lastTs = ts
      const dt = Math.min(0.05, (ts - lastTs) / 1000)
      lastTs = ts

      const width = cssW
      const height = cssH

      ctx.clearRect(0, 0, width, height)
      ctx.globalCompositeOperation = 'lighter'

      for (let i = 0; i < particles.length; i += 1) {
        const p = particles[i]!
        p.life -= dt
        p.x += p.vx * dt
        p.y += p.vy * dt
        // Drift suave: micro-variación sin aceleración fuerte.
        p.vx += (Math.random() - 0.5) * 1.2 * dt
        p.vy += (Math.random() - 0.5) * 1.2 * dt
        p.vx = Math.max(-DRIFT_MAX, Math.min(DRIFT_MAX, p.vx))
        p.vy = Math.max(-DRIFT_MAX, Math.min(DRIFT_MAX, p.vy))

        if (p.x < -4) p.x = width + 4
        else if (p.x > width + 4) p.x = -4
        if (p.y < -4) p.y = height + 4
        else if (p.y > height + 4) p.y = -4

        if (p.life <= 0) {
          particles[i] = spawnParticle(width, height, colors)
          continue
        }
        drawParticle(ctx, p)
      }

      rafId = requestAnimationFrame(tick)
    }

    rafId = requestAnimationFrame(tick)

    return () => {
      running = false
      cancelAnimationFrame(rafId)
      particles.length = 0
      ro?.disconnect()
      window.removeEventListener('resize', resize)
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.clearRect(0, 0, canvas.width, canvas.height)
    }
  }, [shouldRun])

  return (
    <canvas
      ref={canvasRef}
      className="plane-map-grid-particles"
      aria-hidden="true"
    />
  )
}
