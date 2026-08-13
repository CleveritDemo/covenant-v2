/**
 * @vitest-environment jsdom
 */
import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { THEME_MUSIC_BAND_COUNT } from '../../themeMusicEnergy'
import {
  assignRandomGridSlot,
  baseSizeForFrequencyBand,
  colorForFrequencyBand,
  driftSpeedForBpm,
  easeVisualBeatPulse,
  particleGridDims,
  PARTICLE_GRID_CELL_COUNT,
  PARTICLE_GRID_COLS,
  PARTICLE_GRID_ROWS,
  PlaneMapGridParticles,
  positionInGridCell,
  randomGridCell,
} from '../PlaneMapGridParticles'

const getThemeMusicBands = vi.fn(() =>
  Array.from({ length: THEME_MUSIC_BAND_COUNT }, () => 0),
)
const getThemeMusicBeat = vi.fn(() => ({ pulse: 0, bpm: null as number | null }))

vi.mock('../../themeMusicEnergy', async () => {
  const actual = await vi.importActual<typeof import('../../themeMusicEnergy')>(
    '../../themeMusicEnergy',
  )
  return {
    ...actual,
    getThemeMusicBands: (...args: unknown[]) => getThemeMusicBands(...args),
    getThemeMusicBeat: (...args: unknown[]) => getThemeMusicBeat(...args),
  }
})

function mockCanvas2d(): CanvasRenderingContext2D {
  return {
    clearRect: vi.fn(),
    setTransform: vi.fn(),
    beginPath: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    createRadialGradient: vi.fn(() => ({
      addColorStop: vi.fn(),
    })),
    globalAlpha: 1,
    globalCompositeOperation: 'source-over',
    fillStyle: '#000',
  } as unknown as CanvasRenderingContext2D
}

function attachAlphaCapture(ctx: CanvasRenderingContext2D): number[] {
  const alphas: number[] = []
  Object.defineProperty(ctx, 'globalAlpha', {
    configurable: true,
    set(value: number) {
      alphas.push(value)
    },
    get() {
      return alphas[alphas.length - 1] ?? 1
    },
  })
  return alphas
}

function bandsWith(activeBand: number, level: number): number[] {
  return Array.from({ length: THEME_MUSIC_BAND_COUNT }, (_, i) =>
    i === activeBand ? level : 0,
  )
}

describe('PlaneMapGridParticles', () => {
  let rafSpy: ReturnType<typeof vi.spyOn>
  let cancelRafSpy: ReturnType<typeof vi.spyOn>
  let getContextSpy: ReturnType<typeof vi.spyOn>
  let rafCallback: FrameRequestCallback | null
  let ctx: CanvasRenderingContext2D

  beforeEach(() => {
    document.documentElement.removeAttribute('data-reduce-motion')
    getThemeMusicBands.mockClear()
    getThemeMusicBands.mockReturnValue(
      Array.from({ length: THEME_MUSIC_BAND_COUNT }, () => 0),
    )
    getThemeMusicBeat.mockClear()
    getThemeMusicBeat.mockReturnValue({ pulse: 0, bpm: null })
    rafCallback = null
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      onchange: null,
      dispatchEvent: vi.fn(),
    }))

    ctx = mockCanvas2d()
    getContextSpy = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx)

    Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
      configurable: true,
      get: () => 400,
    })
    Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
      configurable: true,
      get: () => 300,
    })

    rafSpy = vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      rafCallback = cb
      return 1
    })
    cancelRafSpy = vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {})
  })

  afterEach(() => {
    cleanup()
    document.documentElement.removeAttribute('data-reduce-motion')
    rafSpy.mockRestore()
    cancelRafSpy.mockRestore()
    getContextSpy.mockRestore()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('monta canvas aria-hidden y arranca rAF con reduce-motion off', () => {
    const { container } = render(
      <div style={{ width: 400, height: 300 }}>
        <PlaneMapGridParticles />
      </div>,
    )

    const canvas = container.querySelector('canvas.plane-map-grid-particles')
    expect(canvas).toBeTruthy()
    expect(canvas?.getAttribute('aria-hidden')).toBe('true')
    expect(rafSpy).toHaveBeenCalled()
  })

  it('con active=false no arranca loop rAF y limpia canvas', () => {
    const clearRect = vi.fn()
    getContextSpy.mockReturnValue({
      ...mockCanvas2d(),
      clearRect,
    } as unknown as CanvasRenderingContext2D)

    render(
      <div style={{ width: 400, height: 300 }}>
        <PlaneMapGridParticles active={false} />
      </div>,
    )

    expect(rafSpy).not.toHaveBeenCalled()
    expect(clearRect).toHaveBeenCalled()
  })

  it('con data-reduce-motion=true no arranca loop rAF y limpia canvas', () => {
    document.documentElement.setAttribute('data-reduce-motion', 'true')
    const clearRect = vi.fn()
    getContextSpy.mockReturnValue({
      ...mockCanvas2d(),
      clearRect,
    } as unknown as CanvasRenderingContext2D)

    render(
      <div style={{ width: 400, height: 300 }}>
        <PlaneMapGridParticles />
      </div>,
    )

    expect(rafSpy).not.toHaveBeenCalled()
    expect(clearRect).toHaveBeenCalled()
  })

  it('en cada tick lee getThemeMusicBands y getThemeMusicBeat una vez', () => {
    render(
      <div style={{ width: 400, height: 300 }}>
        <PlaneMapGridParticles />
      </div>,
    )
    expect(rafCallback).toBeTruthy()
    rafCallback!(16)
    expect(getThemeMusicBands).toHaveBeenCalledTimes(1)
    expect(getThemeMusicBeat).toHaveBeenCalledTimes(1)
    rafCallback!(32)
    expect(getThemeMusicBands).toHaveBeenCalledTimes(2)
    expect(getThemeMusicBeat).toHaveBeenCalledTimes(2)
  })

  it('driftSpeedForBpm escala el recorrido con el tempo', () => {
    expect(driftSpeedForBpm(null)).toBe(1)
    expect(driftSpeedForBpm(0)).toBe(1)
    expect(driftSpeedForBpm(60)).toBeCloseTo(1, 5)
    expect(driftSpeedForBpm(120)).toBeGreaterThan(driftSpeedForBpm(60))
    expect(driftSpeedForBpm(180)).toBeGreaterThan(driftSpeedForBpm(120))
    expect(driftSpeedForBpm(180)).toBeCloseTo(4.8, 5)
    expect(driftSpeedForBpm(300)).toBeCloseTo(4.8, 5)
  })

  it('easeVisualBeatPulse usa smoothstep (no lineal)', () => {
    expect(easeVisualBeatPulse(0)).toBe(0)
    expect(easeVisualBeatPulse(1)).toBe(1)
    expect(easeVisualBeatPulse(0.5)).toBeCloseTo(0.5, 5)
    // En 0.25 el smoothstep queda por debajo de la recta.
    expect(easeVisualBeatPulse(0.25)).toBeLessThan(0.25)
    expect(easeVisualBeatPulse(0.75)).toBeGreaterThan(0.75)
  })

  it('al activar una banda solo suben partículas de esa banda; el resto queda cerca de idle', () => {
    const alphas = attachAlphaCapture(ctx)

    render(
      <div style={{ width: 400, height: 300 }}>
        <PlaneMapGridParticles />
      </div>,
    )
    expect(rafCallback).toBeTruthy()

    getThemeMusicBands.mockReturnValue(
      Array.from({ length: THEME_MUSIC_BAND_COUNT }, () => 0),
    )
    alphas.length = 0
    rafCallback!(0)
    const idleMax = Math.max(0, ...alphas)
    expect(ctx.globalCompositeOperation).toBe('lighter')

    getThemeMusicBands.mockReturnValue(bandsWith(0, 0.9))
    alphas.length = 0
    rafCallback!(16)
    const band0Alphas = [...alphas]
    const band0High = band0Alphas.filter((a) => a > idleMax * 1.8).length
    const band0Low = band0Alphas.filter((a) => a <= idleMax * 1.35).length

    expect(Math.max(0, ...band0Alphas)).toBeGreaterThan(idleMax * 2)
    expect(Math.max(0, ...band0Alphas)).toBeLessThan(1)
    expect(band0High).toBeGreaterThan(0)
    expect(band0Low).toBeGreaterThan(0)
    expect(band0High).toBeLessThan(band0Alphas.length)

    getThemeMusicBands.mockReturnValue(bandsWith(3, 0.9))
    alphas.length = 0
    rafCallback!(32)
    const band3Alphas = [...alphas]
    const band3High = band3Alphas.filter((a) => a > idleMax * 1.8).length
    const band3Low = band3Alphas.filter((a) => a <= idleMax * 1.35).length

    expect(Math.max(0, ...band3Alphas)).toBeGreaterThan(idleMax * 2)
    expect(band3High).toBeGreaterThan(0)
    expect(band3Low).toBeGreaterThan(0)
    expect(band3High).toBeLessThan(band3Alphas.length)
  })

  it('beat alto aumenta radio/alpha/halo; al bajar el beat cae suave sin ir a idle de golpe', () => {
    const alphas = attachAlphaCapture(ctx)
    const radii: number[] = []
    ctx.arc = vi.fn((_x: number, _y: number, r: number) => {
      radii.push(r)
    }) as unknown as typeof ctx.arc

    render(
      <div style={{ width: 400, height: 300 }}>
        <PlaneMapGridParticles />
      </div>,
    )
    expect(rafCallback).toBeTruthy()

    getThemeMusicBands.mockReturnValue(bandsWith(0, 0.7))
    getThemeMusicBeat.mockReturnValue({ pulse: 0, bpm: null })
    alphas.length = 0
    radii.length = 0
    rafCallback!(0)
    rafCallback!(16)
    const alphaWithoutBeat = Math.max(0, ...alphas)
    const radiusWithoutBeat = Math.max(0, ...radii)

    // Varios frames con beat alto para que el pulso visual suba.
    getThemeMusicBands.mockReturnValue(bandsWith(0, 0.7))
    getThemeMusicBeat.mockReturnValue({ pulse: 1, bpm: 120 })
    for (let t = 32; t <= 200; t += 16) {
      alphas.length = 0
      radii.length = 0
      rafCallback!(t)
    }
    const alphasWithBeat = [...alphas]
    const alphaWithBeat = Math.max(0, ...alphasWithBeat)
    const radiusWithBeat = Math.max(0, ...radii)

    expect(radiusWithBeat).toBeGreaterThan(radiusWithoutBeat * 1.12)
    expect(alphaWithBeat).toBeGreaterThan(alphaWithoutBeat)
    expect(alphaWithBeat).toBeLessThan(1)

    // Con beat alto, partículas de banda activa aún brillan más que idle.
    const sorted = [...alphasWithBeat].sort((a, b) => b - a)
    const activePeak = sorted[0]!
    const idleLike = sorted[sorted.length - 1]!
    expect(activePeak).toBeGreaterThan(idleLike * 1.15)

    // Al cortar el beat técnico, el visual cae suave (sigue elevado un frame).
    getThemeMusicBeat.mockReturnValue({ pulse: 0, bpm: null })
    alphas.length = 0
    radii.length = 0
    rafCallback!(216)
    const alphaAfterRelease = Math.max(0, ...alphas)
    const radiusAfterRelease = Math.max(0, ...radii)

    expect(radiusAfterRelease).toBeLessThan(radiusWithBeat)
    expect(radiusAfterRelease).toBeGreaterThan(radiusWithoutBeat * 1.02)
    expect(alphaAfterRelease).toBeLessThan(alphaWithBeat)
    expect(alphaAfterRelease).toBeGreaterThan(alphaWithoutBeat)
    expect(alphaAfterRelease).toBeLessThan(1)
  })

  it('BPM alto desplaza más que BPM null en el mismo dt (hasta ~4.8×)', () => {
    const xs: number[] = []
    ctx.arc = vi.fn((x: number) => {
      xs.push(x)
    }) as unknown as typeof ctx.arc

    // 0.7 → life con fade alto y vx/vy ≠ 0 ((0.7-0.5)*DRIFT).
    const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.7)

    const meanAbsDelta = (a: number[], b: number[]): number => {
      const n = Math.min(a.length, b.length)
      if (n === 0) return 0
      let sum = 0
      for (let i = 0; i < n; i += 1) sum += Math.abs(b[i]! - a[i]!)
      return sum / n
    }

    try {
      render(
        <div style={{ width: 400, height: 300 }}>
          <PlaneMapGridParticles />
        </div>,
      )
      expect(rafCallback).toBeTruthy()

      getThemeMusicBands.mockReturnValue(
        Array.from({ length: THEME_MUSIC_BAND_COUNT }, () => 0),
      )
      getThemeMusicBeat.mockReturnValue({ pulse: 0, bpm: null })
      xs.length = 0
      rafCallback!(16)
      const slowBefore = [...xs]
      expect(slowBefore.length).toBeGreaterThan(0)
      xs.length = 0
      rafCallback!(1016)
      const slowDelta = meanAbsDelta(slowBefore, xs)

      cleanup()
      render(
        <div style={{ width: 400, height: 300 }}>
          <PlaneMapGridParticles />
        </div>,
      )
      getThemeMusicBeat.mockReturnValue({ pulse: 0, bpm: 180 })
      for (let t = 16; t <= 1516; t += 16) rafCallback!(t)
      xs.length = 0
      rafCallback!(1516)
      const fastBefore = [...xs]
      xs.length = 0
      rafCallback!(2516)
      const fastDelta = meanAbsDelta(fastBefore, xs)

      expect(slowDelta).toBeGreaterThan(0)
      expect(fastDelta).toBeGreaterThan(slowDelta * 1.5)
      // Tope teórico 4.8×; con suavizado BPM exigimos al menos ~2.5× de recorrido.
      expect(fastDelta / slowDelta).toBeGreaterThan(2.5)
      expect(driftSpeedForBpm(180) / driftSpeedForBpm(60)).toBeCloseTo(4.8, 5)
    } finally {
      randomSpy.mockRestore()
    }
  })

  it('con bands=0 y beat=1, radio y alpha suben sobre idle sin llegar a 1', () => {
    const alphas = attachAlphaCapture(ctx)
    const radii: number[] = []
    ctx.arc = vi.fn((_x: number, _y: number, r: number) => {
      radii.push(r)
    }) as unknown as typeof ctx.arc

    render(
      <div style={{ width: 400, height: 300 }}>
        <PlaneMapGridParticles />
      </div>,
    )
    expect(rafCallback).toBeTruthy()

    getThemeMusicBands.mockReturnValue(
      Array.from({ length: THEME_MUSIC_BAND_COUNT }, () => 0),
    )
    getThemeMusicBeat.mockReturnValue({ pulse: 0, bpm: null })
    alphas.length = 0
    radii.length = 0
    rafCallback!(0)
    rafCallback!(16)
    const idleAlpha = Math.max(0, ...alphas)
    const idleRadius = Math.max(0, ...radii)

    getThemeMusicBeat.mockReturnValue({ pulse: 1, bpm: 100 })
    for (let t = 32; t <= 200; t += 16) {
      alphas.length = 0
      radii.length = 0
      rafCallback!(t)
    }
    const beatAlpha = Math.max(0, ...alphas)
    const beatRadius = Math.max(0, ...radii)

    expect(beatRadius).toBeGreaterThan(idleRadius)
    expect(beatAlpha).toBeGreaterThan(idleAlpha)
    expect(beatAlpha).toBeLessThan(1)
  })

  it('tamaño base baja con la banda: graves más grandes que agudos', () => {
    const sizes = Array.from({ length: THEME_MUSIC_BAND_COUNT }, (_, b) =>
      baseSizeForFrequencyBand(b),
    )
    for (let b = 1; b < THEME_MUSIC_BAND_COUNT; b += 1) {
      expect(sizes[b]!).toBeLessThan(sizes[b - 1]!)
    }
    expect(sizes[0]!).toBeGreaterThan(sizes[THEME_MUSIC_BAND_COUNT - 1]! * 1.5)

    // En canvas: banda 0 dibuja radio mayor que última banda a misma intensidad.
    const radii: number[] = []
    ctx.arc = vi.fn((_x: number, _y: number, r: number) => {
      radii.push(r)
    }) as unknown as typeof ctx.arc

    render(
      <div style={{ width: 400, height: 300 }}>
        <PlaneMapGridParticles />
      </div>,
    )
    expect(rafCallback).toBeTruthy()

    getThemeMusicBands.mockReturnValue(bandsWith(0, 0.9))
    getThemeMusicBeat.mockReturnValue({ pulse: 0, bpm: null })
    radii.length = 0
    rafCallback!(16)
    const bassMax = Math.max(0, ...radii)

    getThemeMusicBands.mockReturnValue(
      bandsWith(THEME_MUSIC_BAND_COUNT - 1, 0.9),
    )
    radii.length = 0
    rafCallback!(32)
    const trebleMax = Math.max(0, ...radii)

    expect(bassMax).toBeGreaterThan(trebleMax * 1.25)
  })

  it('un color por banda de frecuencia', () => {
    const palette = ['bass', 'low', 'mid', 'high', 'pres', 'air']
    for (let b = 0; b < THEME_MUSIC_BAND_COUNT; b += 1) {
      expect(colorForFrequencyBand(palette, b)).toBe(palette[b])
      expect(colorForFrequencyBand(palette, b + THEME_MUSIC_BAND_COUNT)).toBe(
        palette[b],
      )
    }
    const unique = new Set(
      Array.from({ length: THEME_MUSIC_BAND_COUNT }, (_, b) =>
        colorForFrequencyBand(palette, b),
      ),
    )
    expect(unique.size).toBe(THEME_MUSIC_BAND_COUNT)
  })

  it('grilla fija 6×6; celdas random distintas al excluir; total entre 24 y 36', () => {
    const width = 400
    const height = 300
    const count = 24
    const dims = particleGridDims(count, width, height)
    expect(dims).toEqual({ cols: PARTICLE_GRID_COLS, rows: PARTICLE_GRID_ROWS })
    expect(PARTICLE_GRID_CELL_COUNT).toBe(36)

    // randomGridCell evita la celda excluida.
    for (let exclude = 0; exclude < PARTICLE_GRID_CELL_COUNT; exclude += 1) {
      let seq = 0
      const next = assignRandomGridSlot(
        width,
        height,
        exclude % THEME_MUSIC_BAND_COUNT,
        exclude,
        () => {
          const t = (seq % 10) / 10
          seq += 1
          return t
        },
      )
      expect(next.cell).not.toBe(exclude)
      expect(next.cell).toBeGreaterThanOrEqual(0)
      expect(next.cell).toBeLessThan(PARTICLE_GRID_CELL_COUNT)
    }

    // Posición dentro de la celda pedida.
    const cell = 14
    const pos = positionInGridCell(cell, width, height, () => 0.5)
    const col = cell % PARTICLE_GRID_COLS
    const row = Math.floor(cell / PARTICLE_GRID_COLS)
    const cellW = width / PARTICLE_GRID_COLS
    const cellH = height / PARTICLE_GRID_ROWS
    expect(pos.x).toBeGreaterThan(col * cellW)
    expect(pos.x).toBeLessThan((col + 1) * cellW)
    expect(pos.y).toBeGreaterThan(row * cellH)
    expect(pos.y).toBeLessThan((row + 1) * cellH)

    // randomGridCell sin exclude cubre el rango.
    const cells = new Set(
      Array.from({ length: 80 }, (_, i) => randomGridCell(undefined, () => (i % 36) / 36)),
    )
    expect(cells.size).toBeGreaterThan(10)

    // Spawn no determinista por índice: dos llamadas con RNG distinto → distinta celda.
    const a = assignRandomGridSlot(width, height, 0, undefined, () => 0.1)
    const b = assignRandomGridSlot(width, height, 0, undefined, () => 0.9)
    expect(a.cell).not.toBe(b.cell)

    expect(count).toBeGreaterThanOrEqual(24)
    expect(count).toBeLessThanOrEqual(36)

    // Render live: posiciones dibujadas cubren el área y usan las 6 bandas.
    const positions: Array<{ x: number; y: number }> = []
    ctx.arc = vi.fn((x: number, y: number) => {
      positions.push({ x, y })
    }) as unknown as typeof ctx.arc

    let randomSeq = 0
    const randomSpy = vi.spyOn(Math, 'random').mockImplementation(() => {
      randomSeq += 1
      return ((randomSeq % 36) + 1) / 37
    })

    render(
      <div style={{ width, height }}>
        <PlaneMapGridParticles />
      </div>,
    )
    expect(rafCallback).toBeTruthy()
    getThemeMusicBands.mockReturnValue(
      Array.from({ length: THEME_MUSIC_BAND_COUNT }, () => 0.5),
    )
    rafCallback!(16)

    expect(positions.length).toBeGreaterThanOrEqual(24)
    expect(positions.length).toBeLessThanOrEqual(36)

    const xs = positions.map((p) => p.x)
    const ys = positions.map((p) => p.y)
    expect(Math.min(...xs)).toBeLessThan(width * 0.35)
    expect(Math.max(...xs)).toBeGreaterThan(width * 0.65)
    expect(Math.min(...ys)).toBeLessThan(height * 0.35)
    expect(Math.max(...ys)).toBeGreaterThan(height * 0.65)

    // Cobertura de varias celdas de la grilla 6×6 (no todo en una).
    const liveCells = new Set(
      positions.map((p) => {
        const c = Math.min(PARTICLE_GRID_COLS - 1, Math.floor(p.x / (width / PARTICLE_GRID_COLS)))
        const r = Math.min(PARTICLE_GRID_ROWS - 1, Math.floor(p.y / (height / PARTICLE_GRID_ROWS)))
        return r * PARTICLE_GRID_COLS + c
      }),
    )
    expect(liveCells.size).toBeGreaterThan(6)
    randomSpy.mockRestore()
  })
})
