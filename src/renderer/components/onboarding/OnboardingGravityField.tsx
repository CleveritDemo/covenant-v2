import React, { useEffect, useRef } from 'react'
import { isReduceMotionActive } from '../../reduceMotion'
import './OnboardingGravityField.css'

const COLOR_VARS = ['--accent', '--theme-cyan', '--theme-magenta', '--theme-blue'] as const

type Particle = {
  angle: number
  radius: number
  speed: number
  spin: number
  tone: string
  sizeN: number
  prevX: number
  prevY: number
}

function readPalette(): string[] {
  const styles = getComputedStyle(document.documentElement)
  const colors: string[] = []
  for (const name of COLOR_VARS) {
    const value = styles.getPropertyValue(name).trim()
    if (value) colors.push(value)
  }
  return colors.length > 0 ? colors : ['#7ab8ff']
}

function particleCount(w: number, h: number): number {
  return Math.min(160, Math.max(40, Math.round((w * h) / 14000)))
}

function spawn(
  outerRadius: number,
  palette: string[],
  cx: number,
  cy: number,
  between?: { inner: number; outer: number },
): Particle {
  const angle = Math.random() * Math.PI * 2
  const radius = between
    ? between.inner + Math.random() * (between.outer - between.inner)
    : outerRadius * (0.85 + Math.random() * 0.15)
  const x = cx + Math.cos(angle) * radius
  const y = cy + Math.sin(angle) * radius
  return {
    angle,
    radius,
    speed: 0.35 + Math.random() * 0.55,
    spin: (Math.random() * 2 - 1) * 0.0009,
    tone: palette[Math.floor(Math.random() * palette.length)]!,
    sizeN: 0.55 + Math.random() * 0.5,
    prevX: x,
    prevY: y,
  }
}

function trailAlpha(radius: number, outerRadius: number, innerRadius: number): number {
  const span = Math.max(1, outerRadius - innerRadius)
  const progress = 1 - (radius - innerRadius) / span
  if (progress < 0.12) return (progress / 0.12) * 0.9
  if (progress > 0.82) return ((1 - progress) / 0.18) * 0.9
  return 0.9
}

function drawTrail(
  ctx: CanvasRenderingContext2D,
  p: Particle,
  x: number,
  y: number,
  outerRadius: number,
  innerRadius: number,
): void {
  const alpha = trailAlpha(p.radius, outerRadius, innerRadius)
  if (alpha < 0.01) return
  ctx.strokeStyle = p.tone
  ctx.globalAlpha = alpha
  ctx.lineWidth = 1.1 * p.sizeN
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(p.prevX, p.prevY)
  ctx.lineTo(x, y)
  ctx.stroke()
}

/** Campo de gravedad animado detrás del panel de onboarding. Sin props. */
export const OnboardingGravityField: React.FC = () => {
  const rootRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const root = rootRef.current
    const canvas = canvasRef.current
    if (!root || !canvas) return

    let ctx: CanvasRenderingContext2D | null = null
    try {
      ctx = canvas.getContext('2d')
    } catch {
      return
    }
    if (!ctx) return

    let rafId = 0
    let running = false
    let particles: Particle[] = []
    let palette = readPalette()
    let cssW = 0
    let cssH = 0
    let cx = 0
    let cy = 0
    let outerRadius = 0
    let innerRadius = 0

    const measure = (): void => {
      const rect = root.getBoundingClientRect()
      cssW = Math.max(1, Math.floor(rect.width))
      cssH = Math.max(1, Math.floor(rect.height))
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = Math.floor(cssW * dpr)
      canvas.height = Math.floor(cssH * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      cx = cssW / 2
      cy = cssH / 2
      const minSide = Math.min(cssW, cssH)
      const diagonal = Math.hypot(cssW, cssH)
      innerRadius = minSide * 0.08
      outerRadius = diagonal * 0.6
      palette = readPalette()
      const n = particleCount(cssW, cssH)
      particles = Array.from({ length: n }, () =>
        spawn(outerRadius, palette, cx, cy, {
          inner: innerRadius + (outerRadius - innerRadius) * 0.15,
          outer: outerRadius,
        }),
      )
    }

    const paintStatic = (): void => {
      ctx.clearRect(0, 0, cssW, cssH)
      ctx.globalCompositeOperation = 'lighter'
      for (const p of particles) {
        const x = cx + Math.cos(p.angle) * p.radius
        const y = cy + Math.sin(p.angle) * p.radius
        p.prevX = x
        p.prevY = y
        ctx.strokeStyle = p.tone
        ctx.globalAlpha = 0.5
        ctx.lineWidth = 1.1 * p.sizeN
        ctx.lineCap = 'round'
        ctx.beginPath()
        ctx.moveTo(x, y)
        ctx.lineTo(x + 0.01, y)
        ctx.stroke()
      }
      ctx.globalAlpha = 1
      ctx.globalCompositeOperation = 'source-over'
    }

    const tick = (): void => {
      if (!running) return
      ctx.clearRect(0, 0, cssW, cssH)
      ctx.globalCompositeOperation = 'lighter'
      for (const p of particles) {
        const prevX = cx + Math.cos(p.angle) * p.radius
        const prevY = cy + Math.sin(p.angle) * p.radius
        p.prevX = prevX
        p.prevY = prevY
        p.radius -= p.speed * (1 + (1 - p.radius / outerRadius) * 3.2)
        p.angle += p.spin
        if (p.radius < innerRadius) {
          const next = spawn(outerRadius, palette, cx, cy)
          p.angle = next.angle
          p.radius = next.radius
          p.speed = next.speed
          p.spin = next.spin
          p.tone = next.tone
          p.sizeN = next.sizeN
          p.prevX = cx + Math.cos(p.angle) * p.radius
          p.prevY = cy + Math.sin(p.angle) * p.radius
          continue
        }
        const x = cx + Math.cos(p.angle) * p.radius
        const y = cy + Math.sin(p.angle) * p.radius
        drawTrail(ctx, p, x, y, outerRadius, innerRadius)
      }
      ctx.globalAlpha = 1
      ctx.globalCompositeOperation = 'source-over'
      rafId = requestAnimationFrame(tick)
    }

    const stop = (): void => {
      running = false
      if (rafId) {
        cancelAnimationFrame(rafId)
        rafId = 0
      }
    }

    const start = (): void => {
      if (running || document.hidden || isReduceMotionActive()) return
      running = true
      rafId = requestAnimationFrame(tick)
    }

    measure()

    if (isReduceMotionActive()) {
      paintStatic()
    } else if (!document.hidden) {
      start()
    }

    const onVisibility = (): void => {
      if (document.hidden) {
        stop()
      } else if (!isReduceMotionActive()) {
        start()
      }
    }

    document.addEventListener('visibilitychange', onVisibility)
    const ro = typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(() => {
          measure()
          if (isReduceMotionActive()) {
            paintStatic()
          }
        })
      : null
    ro?.observe(root)

    return () => {
      stop()
      document.removeEventListener('visibilitychange', onVisibility)
      ro?.disconnect()
    }
  }, [])

  return (
    <div ref={rootRef} className="onboarding-gravity-field" aria-hidden="true">
      <canvas ref={canvasRef} className="onboarding-gravity-field__canvas" />
    </div>
  )
}
