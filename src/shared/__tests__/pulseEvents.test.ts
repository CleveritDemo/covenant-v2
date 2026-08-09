import { describe, expect, it } from 'vitest'
import {
  aggregateAgents,
  aggregatePulse,
  filterPulseEvents,
  PERSONAL_SCOPE,
  pulseScopeOptions,
  pulseWorkspaceTag,
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

describe('filterPulseEvents', () => {
  const events: PulseEvent[] = [
    prompt('2026-08-01', { workspace: 'acme/ws1', repo: 'app' }),
    prompt('2026-08-02', { workspace: 'acme/ws2', repo: 'app' }),
    prompt('2026-08-03', { repo: 'otro' }),
    commit('2026-08-04'),
  ]

  it('sin alcance devuelve el mismo arreglo', () => {
    expect(filterPulseEvents(events)).toBe(events)
  })

  it('filtra por workspace', () => {
    expect(filterPulseEvents(events, { workspace: 'acme/ws1' })).toHaveLength(1)
  })

  it('PERSONAL_SCOPE selecciona lo que no tiene workspace, no todo', () => {
    const personal = filterPulseEvents(events, { workspace: PERSONAL_SCOPE })
    expect(personal).toHaveLength(2)
    expect(personal.every(e => !e.workspace)).toBe(true)
  })

  it('combina repo y rango', () => {
    expect(filterPulseEvents(events, { repo: 'app', sinceDay: '2026-08-02' })).toHaveLength(1)
  })
})

describe('pulseScopeOptions', () => {
  it('lista workspaces y repos únicos y marca lo personal', () => {
    const opts = pulseScopeOptions([
      prompt('2026-08-01', { workspace: 'b/ws', repo: 'z' }),
      prompt('2026-08-02', { workspace: 'a/ws', repo: 'z' }),
      prompt('2026-08-03', { repo: 'y' }),
    ])
    expect(opts.workspaces).toEqual(['a/ws', 'b/ws'])
    expect(opts.repos).toEqual(['y', 'z'])
    expect(opts.hasPersonal).toBe(true)
  })

  it('sin eventos personales no ofrece la opción', () => {
    expect(pulseScopeOptions([prompt('2026-08-01', { workspace: 'a/ws' })]).hasPersonal).toBe(false)
  })
})

describe('aggregateAgents', () => {
  const now = noon('2026-08-09')
  const events: PulseEvent[] = [
    prompt('2026-08-09', { agentId: 'qa', provider: 'claude', permissionMode: 'ask', tokensIn: 100, tokensOut: 20, repo: 'app' }),
    prompt('2026-08-08', { agentId: 'qa', provider: 'cursor', permissionMode: 'auto', repo: 'otro' }),
    prompt('2026-08-08', { agentId: 'fullstack', permissionMode: 'auto', tokensIn: 1_000, tokensOut: 500, repo: 'app' }),
    prompt('2026-08-07', { agentId: 'fullstack', permissionMode: 'auto', repo: 'app' }),
    prompt('2026-08-06', { agentId: 'fullstack', repo: 'app' }),
    // Ni los commits ni los prompts sin agentId entran en el corte por agente.
    commit('2026-08-09'),
    prompt('2026-08-09'),
  ]

  it('ordena por turnos y no cuenta commits ni prompts sin agente', () => {
    const rows = aggregateAgents(events, now)
    expect(rows.map(r => r.agentId)).toEqual(['fullstack', 'qa'])
    expect(rows[0]!.turns).toBe(3)
    expect(rows[1]!.turns).toBe(2)
  })

  it('suma tokens, días activos y reparte los modos', () => {
    const qa = aggregateAgents(events, now).find(r => r.agentId === 'qa')!
    expect(qa.tokens).toBe(120)
    expect(qa.activeDays).toBe(2)
    expect(qa.modes).toEqual({ ask: 1, plan: 0, auto: 1, other: 0 })
  })

  it('un modo ausente cae en other en vez de perderse', () => {
    const fs = aggregateAgents(events, now).find(r => r.agentId === 'fullstack')!
    expect(fs.modes).toEqual({ ask: 0, plan: 0, auto: 2, other: 1 })
  })

  it('el provider es el del último turno', () => {
    const qa = aggregateAgents(events, now).find(r => r.agentId === 'qa')!
    expect(qa.provider).toBe('claude')
  })

  it('la serie alinea el último día con hoy', () => {
    const [fs] = aggregateAgents(events, now)
    expect(fs!.series).toHaveLength(30)
    expect(fs!.series.at(-1)).toBe(0) // hoy no trabajó
    expect(fs!.series.at(-2)).toBe(1) // ayer, un turno
    expect(fs!.series.reduce((a, b) => a + b, 0)).toBe(3)
  })

  it('descarta de la serie lo que cae fuera de la ventana, sin perderlo del total', () => {
    const viejo = [prompt('2026-01-01', { agentId: 'qa' }), ...events]
    const qa = aggregateAgents(viejo, now).find(r => r.agentId === 'qa')!
    expect(qa.turns).toBe(3)
    expect(qa.series.reduce((a, b) => a + b, 0)).toBe(2)
  })

  it('ordena los repos por turnos', () => {
    const rows = aggregateAgents(events, now)
    expect(rows[0]!.repos).toEqual([{ repo: 'app', turns: 3 }])
    expect(rows[1]!.repos.map(r => r.repo)).toEqual(['app', 'otro'])
  })
})

describe('atribución de commits y duración', () => {
  const now = noon('2026-08-09')

  it('cuenta los commits del agente aparte de los turnos', () => {
    const rows = aggregateAgents([
      prompt('2026-08-09', { agentId: 'dev' }),
      { ...commit('2026-08-09'), agentId: 'dev' },
      { ...commit('2026-08-08'), agentId: 'dev' },
    ], now)
    expect(rows[0]!.turns).toBe(1)
    expect(rows[0]!.commits).toBe(2)
    // Un commit no es un turno: no puede inflar la serie de turnos/día.
    expect(rows[0]!.series.reduce((a, b) => a + b, 0)).toBe(1)
  })

  it('ignora los commits sin agente: esos son de la persona', () => {
    expect(aggregateAgents([commit('2026-08-09')], now)).toEqual([])
  })

  it('un commit cuenta como día activo y mueve el último movimiento', () => {
    const [row] = aggregateAgents([
      prompt('2026-08-07', { agentId: 'dev' }),
      { ...commit('2026-08-09'), agentId: 'dev' },
    ], now)
    expect(row!.activeDays).toBe(2)
    expect(dayFromMs(row!.lastTs)).toBe('2026-08-09')
  })

  it('promedia solo los turnos que traen duración', () => {
    const [row] = aggregateAgents([
      prompt('2026-08-09', { agentId: 'dev', durationMs: 1_000 }),
      prompt('2026-08-09', { agentId: 'dev', durationMs: 3_000 }),
      prompt('2026-08-09', { agentId: 'dev' }), // histórico sin instrumentar
    ], now)
    expect(row!.avgDurationMs).toBe(2_000)
  })

  it('sin ninguna duración el promedio es 0, no NaN', () => {
    const [row] = aggregateAgents([prompt('2026-08-09', { agentId: 'dev' })], now)
    expect(row!.avgDurationMs).toBe(0)
  })
})

describe('pulseWorkspaceTag', () => {
  it('arma slug/workspaceId', () => {
    expect(pulseWorkspaceTag({ slug: 'acme', workspaceId: 'ws1' })).toBe('acme/ws1')
  })

  it('sin uno de los dos es pestaña personal', () => {
    expect(pulseWorkspaceTag({ slug: 'acme' })).toBeNull()
    expect(pulseWorkspaceTag({ slug: '  ', workspaceId: 'ws1' })).toBeNull()
    expect(pulseWorkspaceTag(null)).toBeNull()
  })
})

describe('delegaciones y resultados', () => {
  const now = noon('2026-08-09')
  const events: PulseEvent[] = [
    prompt('2026-08-09', { agentId: 'tl', agentName: 'example TL' }),
    { ts: noon('2026-08-09'), kind: 'delegate', agentId: 'tl', toAgentId: 'dev' },
    { ts: noon('2026-08-09'), kind: 'delegate', agentId: 'tl', toAgentId: 'qa' },
    { ts: noon('2026-08-09'), kind: 'result', agentId: 'dev' },
  ]

  it('no cuentan como turnos ni como commits del calendario', () => {
    const stats = aggregatePulse(events, now)
    expect(stats.totalPrompts).toBe(1)
    expect(stats.totalCommits).toBe(0)
  })

  it('un día con solo delegaciones no se vuelve día activo ni estira la racha', () => {
    // 08-09 tiene un prompt; 08-08 solo una delegación: la racha debe ser 1.
    const stats = aggregatePulse([
      ...events,
      { ts: noon('2026-08-08'), kind: 'delegate', agentId: 'tl', toAgentId: 'dev' },
    ], now)
    expect(stats.days.map(d => d.day)).toEqual(['2026-08-09'])
    expect(stats.currentStreak).toBe(1)
  })

  it('reparte emitidas y recibidas entre orquestador y ejecutores', () => {
    const rows = aggregateAgents(events, now)
    const tl = rows.find(r => r.agentId === 'tl')!
    const dev = rows.find(r => r.agentId === 'dev')!
    const qa = rows.find(r => r.agentId === 'qa')!
    expect(tl.delegationsOut).toBe(2)
    expect(tl.delegationsIn).toBe(0)
    expect(dev.delegationsIn).toBe(1)
    expect(qa.delegationsIn).toBe(1)
  })

  it('crea la fila del destino aunque nunca haya tenido un turno propio', () => {
    const qa = aggregateAgents(events, now).find(r => r.agentId === 'qa')!
    expect(qa.turns).toBe(0)
    expect(qa.activeDays).toBe(0)
  })

  it('cuenta los resultados escritos por su autor', () => {
    const dev = aggregateAgents(events, now).find(r => r.agentId === 'dev')!
    expect(dev.results).toBe(1)
    expect(dev.turns).toBe(0)
  })

  it('el nombre del catálogo gana al id cuando está', () => {
    const tl = aggregateAgents(events, now).find(r => r.agentId === 'tl')!
    expect(tl.name).toBe('example TL')
  })
})

describe('turnos de loop', () => {
  const now = noon('2026-08-09')

  it('son un subconjunto de los turnos, no una categoría aparte', () => {
    const [row] = aggregateAgents([
      prompt('2026-08-09', { agentId: 'dev', viaLoop: true }),
      prompt('2026-08-09', { agentId: 'dev', viaLoop: true }),
      prompt('2026-08-09', { agentId: 'dev' }),
    ], now)
    expect(row!.turns).toBe(3)
    expect(row!.loopTurns).toBe(2)
  })

  it('un turno de loop sigue contando como prompt del calendario', () => {
    const stats = aggregatePulse([prompt('2026-08-09', { agentId: 'dev', viaLoop: true })], now)
    expect(stats.totalPrompts).toBe(1)
  })
})
