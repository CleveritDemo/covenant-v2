import React, { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { isReduceMotionActive } from '../reduceMotion'
import './PlaneComposerAuroraParticles.css'

type PlaneComposerAuroraParticlesProps = {
  active: boolean
  tabActive?: boolean
}

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

const COLOR_VARS = ['--accent', '--theme-cyan', '--theme-magenta', '--theme-blue'] as const
const FIELD_HEIGHT = 160
const MAX_PARTICLES = 42
const SPAWN_INTERVAL_MS = 56
/** Margen inferior para que el radio no se recorte en el borde del canvas. */
const SPAWN_BOTTOM_MARGIN = 16
/** Pico de opacidad: legible bajo el glass suave, sin competir con el texto. */
const ALPHA_PEAK = 0.9

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
  return colors.length > 0 ? colors : ['rgba(120, 180, 255, 0.7)']
}

function spawnParticle(width: number, height: number, colors: string[]): Particle {
  const maxLife = 2.2 + Math.random() * 1.8
  return {
    x: Math.random() * width,
    y: height - SPAWN_BOTTOM_MARGIN - Math.random() * 8,
    vx: (Math.random() - 0.5) * 22,
    vy: -(16 + Math.random() * 36),
    life: maxLife,
    maxLife,
    size: 2.4 + Math.random() * 3.8,
    color: colors[Math.floor(Math.random() * colors.length)]!,
  }
}

function drawParticle(
  ctx: CanvasRenderingContext2D,
  p: Particle,
): void {
  const t = 1 - p.life / p.maxLife
  const fade = Math.sin(Math.min(1, p.life / p.maxLife) * Math.PI)
  const alpha = Math.max(0, fade * ALPHA_PEAK * (1 - t * 0.18))
  if (alpha < 0.02) return

  const radius = p.size * (1 - t * 0.45)
  if (radius < 0.2) return

  // Punto sólido, sin halo ni bloom.
  ctx.globalAlpha = alpha
  ctx.fillStyle = p.color
  ctx.beginPath()
  ctx.arc(p.x, p.y, Math.max(0.7, radius * 0.55), 0, Math.PI * 2)
  ctx.fill()
}

/** Partículas que suben desde el piso del plano (solo working + motion). */
export const PlaneComposerAuroraParticles: React.FC<PlaneComposerAuroraParticlesProps> = ({
  active,
  tabActive = true,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const reducedMotion = usePrefersReducedMotion()
  const shouldRun = active && tabActive && !reducedMotion

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
    let spawnAcc = 0
    const particles: Particle[] = []
    let colors = readThemeColors(canvas)

    const resize = (): void => {
      const cssWidth = canvas.clientWidth
      const cssHeight = Math.max(1, canvas.clientHeight || FIELD_HEIGHT)
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const w = Math.max(1, Math.floor(cssWidth))
      const h = Math.max(1, Math.floor(cssHeight))
      canvas.width = Math.floor(w * dpr)
      canvas.height = Math.floor(h * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      colors = readThemeColors(canvas)
    }

    resize()
    const ro = typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(resize)
      : null
    ro?.observe(canvas)
    window.addEventListener('resize', resize)

    const tick = (ts: number): void => {
      if (!running) return
      if (!lastTs) lastTs = ts
      const dt = Math.min(0.05, (ts - lastTs) / 1000)
      lastTs = ts

      const width = canvas.clientWidth || 1
      const height = canvas.clientHeight || FIELD_HEIGHT

      spawnAcc += dt * 1000
      while (spawnAcc >= SPAWN_INTERVAL_MS && particles.length < MAX_PARTICLES) {
        spawnAcc -= SPAWN_INTERVAL_MS
        particles.push(spawnParticle(width, height, colors))
      }
      if (particles.length >= MAX_PARTICLES) spawnAcc = 0

      ctx.clearRect(0, 0, width, height)
      ctx.globalCompositeOperation = 'source-over'

      for (let i = particles.length - 1; i >= 0; i -= 1) {
        const p = particles[i]!
        p.life -= dt
        p.x += p.vx * dt
        p.y += p.vy * dt
        p.vx += (Math.random() - 0.5) * 8 * dt
        p.vy -= 6 * dt

        if (p.life <= 0 || p.y < -8) {
          particles.splice(i, 1)
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
      className="plane-composer-aurora-particles"
      aria-hidden="true"
    />
  )
}
