import React, { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { isReduceMotionActive } from '../reduceMotion'
import {
  getThemeMusicBands,
  getThemeMusicBeat,
  THEME_MUSIC_BAND_COUNT,
} from '../themeMusicEnergy'
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
  /** Banda de frecuencia asociada (estable por índice de partícula). */
  frequencyBand: number
  /** Celda 6×6 actual (0..35); al renacer se elige otra si es posible. */
  gridCell: number
  /** Variación leve 0.85–1 sobre la intensidad de banda. */
  sparkleBias: number
  /** Jitter pequeño 0–0.08; no debe dominar la banda. */
  pulseJitter: number
}

/** Un color de tema por banda (índice = frequencyBand). */
const BAND_COLOR_VARS = [
  '--accent',
  '--theme-cyan',
  '--theme-blue',
  '--theme-magenta',
  '--plane-terminal-accent',
  '--caution',
] as const

const MIN_PARTICLES = 24
const MAX_PARTICLES = 36
/** Opacidad base sin energía de banda (rango original pre-ensanche). */
const ALPHA_IDLE = 0.14
/** Pico de opacidad con banda activa (nunca 1; rango original). */
const ALPHA_MUSIC_PEAK = 0.62
/** Escalado de radio con intensidad de banda. */
const SIZE_BAND_PULSE = 0.55
/** Escalado global de radio con beat visual (suave). */
const SIZE_BEAT_PULSE = 0.5
/** Boost de alpha global por beat visual (discreto; manda la banda). */
const ALPHA_BEAT_BOOST = 0.14
/** Tope de alpha tras idle + banda + beat. */
const ALPHA_CAP = 0.88
/** Radio base: graves (banda 0) grandes → agudos (última) chicos. */
const SIZE_BAND_LOW = 2.15
const SIZE_BAND_HIGH = 0.55
/** Jitter leve sobre el tamaño de banda (±). */
const SIZE_BAND_JITTER = 0.12
/** Halo base / expansión suave con beat visual. */
const HALO_SCALE_BASE = 2.2
const HALO_SCALE_BEAT = 0.28
/** Drift máximo en CSS px/s (lento). */
const DRIFT_MAX = 6
/** Grilla responsive fija sobre todo el canvas. */
export const PARTICLE_GRID_COLS = 6
export const PARTICLE_GRID_ROWS = 6
export const PARTICLE_GRID_CELL_COUNT = PARTICLE_GRID_COLS * PARTICLE_GRID_ROWS
/** Inset relativo dentro de cada celda (evita bordes duros). */
const CELL_INSET = 0.15
/** Ataque del pulso visual (moderado, por frame a 60fps). */
const VISUAL_BEAT_ATTACK = 0.42
/** Release del pulso visual (más lento que el ataque). */
const VISUAL_BEAT_RELEASE = 0.12

/**
 * Tamaño base por banda de frecuencia: más grave → más grande.
 * Banda 0 ≈ SIZE_BAND_LOW; última ≈ SIZE_BAND_HIGH.
 */
export function baseSizeForFrequencyBand(band: number): number {
  const last = Math.max(1, THEME_MUSIC_BAND_COUNT - 1)
  const t = Math.min(1, Math.max(0, band / last))
  return SIZE_BAND_LOW + (SIZE_BAND_HIGH - SIZE_BAND_LOW) * t
}

/**
 * Curva estética del beat: smoothstep para evitar crecimiento lineal brusco.
 */
export function easeVisualBeatPulse(raw: number): number {
  const t = Math.min(1, Math.max(0, raw))
  return t * t * (3 - 2 * t)
}

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
  const fallback = 'rgba(120, 180, 255, 0.35)'
  return BAND_COLOR_VARS.map((name) => {
    const value = styles.getPropertyValue(name).trim()
    return value || fallback
  })
}

/** Color CSS resuelto para una banda (mismo para todas las de ese rango). */
export function colorForFrequencyBand(
  colors: readonly string[],
  band: number,
): string {
  const safe = colors.length > 0 ? colors : ['rgba(120, 180, 255, 0.35)']
  const idx = ((band % safe.length) + safe.length) % safe.length
  return safe[idx]!
}

/** Dimensiones de grilla fija 6×6 sobre el canvas. */
export function particleGridDims(
  _count?: number,
  _width?: number,
  _height?: number,
): { cols: number; rows: number } {
  return { cols: PARTICLE_GRID_COLS, rows: PARTICLE_GRID_ROWS }
}

/**
 * Índice de celda random (0..35). Si `excludeCell` es válido y hay >1 celda,
 * garantiza una distinta.
 */
export function randomGridCell(
  excludeCell?: number,
  random: () => number = Math.random,
): number {
  const total = PARTICLE_GRID_CELL_COUNT
  if (
    excludeCell === undefined
    || excludeCell < 0
    || excludeCell >= total
    || total <= 1
  ) {
    return Math.floor(random() * total)
  }
  const r = Math.floor(random() * (total - 1))
  return r >= excludeCell ? r + 1 : r
}

/** Posición random dentro de una celda de la grilla 6×6. */
export function positionInGridCell(
  cell: number,
  width: number,
  height: number,
  random: () => number = Math.random,
): { x: number; y: number } {
  const safe = ((cell % PARTICLE_GRID_CELL_COUNT) + PARTICLE_GRID_CELL_COUNT)
    % PARTICLE_GRID_CELL_COUNT
  const col = safe % PARTICLE_GRID_COLS
  const row = Math.floor(safe / PARTICLE_GRID_COLS)
  const cellW = Math.max(1, width) / PARTICLE_GRID_COLS
  const cellH = Math.max(1, height) / PARTICLE_GRID_ROWS
  const inset = CELL_INSET
  return {
    x: col * cellW + cellW * (inset + random() * (1 - 2 * inset)),
    y: row * cellH + cellH * (inset + random() * (1 - 2 * inset)),
  }
}

/**
 * Slot orgánico: celda random de la grilla 6×6 + offset dentro de la celda.
 * `frequencyBand` lo aporta el caller (estable por partícula).
 */
export function assignRandomGridSlot(
  width: number,
  height: number,
  frequencyBand: number,
  excludeCell?: number,
  random: () => number = Math.random,
): { x: number; y: number; frequencyBand: number; cell: number } {
  const cell = randomGridCell(excludeCell, random)
  const pos = positionInGridCell(cell, width, height, random)
  return {
    x: pos.x,
    y: pos.y,
    frequencyBand,
    cell,
  }
}

function bandIntensityForParticle(p: Particle, bandLevel: number): number {
  if (bandLevel <= 0.001) return 0
  // sparkleBias/jitter solo variación leve; manda la banda.
  const biased = bandLevel * (0.92 + (p.sparkleBias - 0.85) * 0.4)
  return Math.min(1, Math.max(0, biased * (1 + p.pulseJitter * 0.15)))
}

function spawnParticle(
  width: number,
  height: number,
  colors: string[],
  index: number,
  previousCell?: number,
): Particle {
  const maxLife = 4 + Math.random() * 6
  const frequencyBand = index % THEME_MUSIC_BAND_COUNT
  const slot = assignRandomGridSlot(width, height, frequencyBand, previousCell)
  const bandSize = baseSizeForFrequencyBand(frequencyBand)
  const sizeJitter = (((index * 19) % 21) / 20 - 0.5) * 2 * SIZE_BAND_JITTER
  return {
    x: slot.x,
    y: slot.y,
    vx: (Math.random() - 0.5) * DRIFT_MAX * 2,
    vy: (Math.random() - 0.5) * DRIFT_MAX * 2,
    life: Math.random() * maxLife,
    maxLife,
    size: Math.max(0.35, bandSize + sizeJitter),
    color: colorForFrequencyBand(colors, frequencyBand),
    frequencyBand,
    gridCell: slot.cell,
    sparkleBias: 0.85 + ((index * 13) % 16) / 100,
    pulseJitter: ((index * 17) % 9) / 100,
  }
}

function drawParticle(
  ctx: CanvasRenderingContext2D,
  p: Particle,
  bandIntensity: number,
  beatPulse: number,
): void {
  const lifeRatio = Math.min(1, Math.max(0, p.life / p.maxLife))
  const fade = Math.sin(lifeRatio * Math.PI)
  const intensity = Math.min(1, Math.max(0, bandIntensity))
  const beat = Math.min(1, Math.max(0, beatPulse))
  const bandBoost = (ALPHA_MUSIC_PEAK - ALPHA_IDLE) * intensity
  const beatBoost = ALPHA_BEAT_BOOST * beat
  // Beat eleva el piso; la banda mantiene quién brilla más.
  const alpha = Math.max(
    0,
    fade * Math.min(ALPHA_CAP, ALPHA_IDLE + bandBoost + beatBoost),
  )
  if (alpha < 0.01) return

  const radius = p.size * (
    1 + SIZE_BAND_PULSE * intensity + SIZE_BEAT_PULSE * beat
  )
  if (radius < 0.15) return

  const haloScale = HALO_SCALE_BASE + HALO_SCALE_BEAT * beat
  const drawRadius = radius * haloScale
  const gradient = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, drawRadius)
  gradient.addColorStop(0, p.color)
  gradient.addColorStop(0.5, p.color)
  gradient.addColorStop(1, 'transparent')

  ctx.globalAlpha = alpha
  ctx.fillStyle = gradient
  ctx.beginPath()
  ctx.arc(p.x, p.y, drawRadius, 0, Math.PI * 2)
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
    /** Pulso visual suavizado (independiente del beat técnico). */
    let visualBeatPulse = 0
    const particles: Particle[] = []
    let colors = readThemeColors(canvas)
    let cssW = 1
    let cssH = 1

    const relocateParticles = (w: number, h: number): void => {
      for (let i = 0; i < particles.length; i += 1) {
        const p = particles[i]!
        const cell = ((p.gridCell % PARTICLE_GRID_CELL_COUNT) + PARTICLE_GRID_CELL_COUNT)
          % PARTICLE_GRID_CELL_COUNT
        const pos = positionInGridCell(cell, w, h)
        p.x = pos.x
        p.y = pos.y
        p.gridCell = cell
      }
    }

    const resize = (): void => {
      const parent = canvas.parentElement
      const w = Math.max(1, Math.floor(parent?.clientWidth ?? canvas.clientWidth))
      const h = Math.max(1, Math.floor(parent?.clientHeight ?? canvas.clientHeight))
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = Math.floor(w * dpr)
      canvas.height = Math.floor(h * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      const sizeChanged = Math.abs(w - cssW) > 1 || Math.abs(h - cssH) > 1
      cssW = w
      cssH = h
      colors = readThemeColors(canvas)
      // Reubica en celdas válidas del nuevo tamaño (misma celda, nuevo offset).
      if (sizeChanged && particles.length > 0) {
        relocateParticles(w, h)
      }
    }

    resize()

    const count = MIN_PARTICLES
      + Math.floor(Math.random() * (MAX_PARTICLES - MIN_PARTICLES + 1))
    for (let i = 0; i < count; i += 1) {
      particles.push(spawnParticle(cssW, cssH, colors, i))
    }
    // Por si el primer layout aún no tenía tamaño real.
    relocateParticles(cssW, cssH)

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

      const bands = getThemeMusicBands()
      const beat = getThemeMusicBeat()
      const target = Math.min(1, Math.max(0, beat.pulse))
      const rate = target > visualBeatPulse
        ? VISUAL_BEAT_ATTACK
        : VISUAL_BEAT_RELEASE
      const blend = 1 - Math.pow(1 - rate, dt * 60)
      visualBeatPulse += (target - visualBeatPulse) * blend
      const drawBeat = easeVisualBeatPulse(visualBeatPulse)

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
          // Misma banda (índice); celda distinta a la anterior si es posible.
          particles[i] = spawnParticle(width, height, colors, i, p.gridCell)
          continue
        }

        const bandLevel = bands[p.frequencyBand] ?? 0
        const pulseIntensity = bandIntensityForParticle(p, bandLevel)
        drawParticle(ctx, p, pulseIntensity, drawBeat)
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
