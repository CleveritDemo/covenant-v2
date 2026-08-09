import { describe, expect, it } from 'vitest'
import {
  aggregatePulse,
  dayFromMs,
  heatmapGrid,
  intensityLevels,
  levelFor,
  shiftDay,
  type PulseEvent,
} from '../pulseEvents'

/** epoch ms del mediodía local de un día ISO — evita que la tz corra la fecha. */
function noon(day: string): number {
  const [y, m, d] = day.split('-').map(Number)
  return new Date(y!, m! - 1, d!, 12, 0, 0).getTime()
}

function prompt(day: string, extra: Partial<PulseEvent> = {}): PulseEvent {
  return { ts: noon(day), kind: 'prompt', ...extra }
}

function commit(day: string): PulseEvent {
  return { ts: noon(day), kind: 'commit' }
}

describe('shiftDay', () => {
  it('cruza fin de mes y año bisiesto', () => {
    expect(shiftDay('2026-01-31', 1)).toBe('2026-02-01')
    expect(shiftDay('2024-02-28', 1)).toBe('2024-02-29')
    expect(shiftDay('2026-01-01', -1)).toBe('2025-12-31')
  })

  it('no salta días al cruzar un cambio de horario de verano', () => {
    // En tz con DST el 2026-03-29 dura 23h; sumar 24h sobre hora local saltaría.
    let day = '2026-03-27'
    for (let i = 0; i < 5; i++) day = shiftDay(day, 1)
    expect(day).toBe('2026-04-01')
  })
})

describe('aggregatePulse', () => {
  it('suma totales, tokens y el día de hoy', () => {
    const snap = aggregatePulse(
      [
        prompt('2026-08-08', { tokensIn: 1000, tokensOut: 50 }),
        prompt('2026-08-08', { tokensIn: 200, tokensOut: 10 }),
        commit('2026-08-08'),
        prompt('2026-08-01'),
      ],
      noon('2026-08-08'),
    )
    expect(snap.totalPrompts).toBe(3)
    expect(snap.totalCommits).toBe(1)
    expect(snap.totalTokens).toBe(1260)
    expect(snap.todayPrompts).toBe(2)
    expect(snap.todayCommits).toBe(1)
  })

  it('cuenta la racha viva hacia atrás desde hoy', () => {
    const snap = aggregatePulse(
      ['2026-08-06', '2026-08-07', '2026-08-08'].map(d => prompt(d)),
      noon('2026-08-08'),
    )
    expect(snap.currentStreak).toBe(3)
  })

  it('mantiene la racha si hoy todavía no hay actividad pero ayer sí', () => {
    const snap = aggregatePulse(
      ['2026-08-06', '2026-08-07'].map(d => prompt(d)),
      noon('2026-08-08'),
    )
    expect(snap.currentStreak).toBe(2)
  })

  it('rompe la racha con dos días de silencio', () => {
    const snap = aggregatePulse(
      ['2026-08-05', '2026-08-06'].map(d => prompt(d)),
      noon('2026-08-08'),
    )
    expect(snap.currentStreak).toBe(0)
    expect(snap.longestStreak).toBe(2)
  })

  it('la racha más larga puede estar en el pasado', () => {
    const snap = aggregatePulse(
      ['2026-07-01', '2026-07-02', '2026-07-03', '2026-07-04', '2026-08-08'].map(d => prompt(d)),
      noon('2026-08-08'),
    )
    expect(snap.longestStreak).toBe(4)
    expect(snap.currentStreak).toBe(1)
  })

  it('promedia 30 días sin contar hoy', () => {
    // 60 prompts repartidos en los 30 días previos → media 2/día.
    const events = Array.from({ length: 30 }, (_, i) => shiftDay('2026-08-08', -(i + 1))).flatMap(
      d => [prompt(d), prompt(d)],
    )
    const snap = aggregatePulse([...events, prompt('2026-08-08')], noon('2026-08-08'))
    expect(snap.avgPrompts30d).toBe(2)
  })

  it('no explota sin eventos', () => {
    const snap = aggregatePulse([], noon('2026-08-08'))
    expect(snap).toMatchObject({ totalPrompts: 0, currentStreak: 0, avgPrompts30d: 0, days: [] })
  })
})

describe('heatmapGrid', () => {
  it('devuelve una grilla rectangular que termina en la semana de endDay', () => {
    const grid = heatmapGrid([{ day: '2026-08-08', prompts: 3, commits: 1 }], '2026-08-08', 53)
    expect(grid).toHaveLength(53)
    expect(grid.every(col => col.length === 7)).toBe(true)
    // 2026-08-08 es sábado: cae en la última posición de la última columna.
    expect(grid[52]![6]).toEqual({ day: '2026-08-08', prompts: 3, commits: 1 })
  })

  it('rellena con ceros los días sin actividad', () => {
    const grid = heatmapGrid([], '2026-08-08', 2)
    expect(grid.flat()).toHaveLength(14)
    expect(grid.flat().every(c => c.prompts === 0 && c.commits === 0)).toBe(true)
  })
})

describe('intensidad', () => {
  it('reparte por cuantiles, no por umbrales fijos', () => {
    const bajo = intensityLevels([1, 2, 3, 4])
    const alto = intensityLevels([100, 200, 300, 400])
    expect(levelFor(4, bajo)).toBe(4)
    expect(levelFor(4, alto)).toBe(1)
    expect(levelFor(400, alto)).toBe(4)
  })

  it('un día vacío siempre es nivel 0', () => {
    expect(levelFor(0, intensityLevels([5, 10]))).toBe(0)
    expect(levelFor(0, intensityLevels([]))).toBe(0)
  })
})

describe('dayFromMs', () => {
  it('formatea ISO local con padding', () => {
    expect(dayFromMs(new Date(2026, 0, 5, 12).getTime())).toBe('2026-01-05')
  })
})
