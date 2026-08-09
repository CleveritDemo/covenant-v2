/**
 * Pulse — agregación pura de la telemetría local.
 *
 * El store (`electron/pulseStore.ts`) solo hace append y lectura de un NDJSON;
 * toda la aritmética de rachas, totales y heatmap vive acá para poder testearla
 * sin Electron ni disco, igual que el resto de las máquinas de estado del app.
 */

export type PulseEventKind = 'prompt' | 'commit'

export interface PulseEvent {
  /** epoch ms */
  ts: number
  kind: PulseEventKind
  /** basename del repo root, si el evento ocurrió dentro de uno. */
  repo?: string
  /** CLI que atendió el turno (solo prompts). */
  provider?: string
  /** Id del catálogo del agente que envió el turno (solo prompts). */
  agentId?: string
  /** Tokens reportados por el CLI al cerrar el turno; `in` incluye la caché. */
  tokensIn?: number
  tokensOut?: number
}

export interface PulseDay {
  /** ISO YYYY-MM-DD en la tz local del equipo que grabó. */
  day: string
  prompts: number
  commits: number
}

export interface PulseSnapshot {
  totalPrompts: number
  totalCommits: number
  totalTokens: number
  todayPrompts: number
  todayCommits: number
  currentStreak: number
  longestStreak: number
  /** Media de prompts/día en los 30 días previos a hoy. 0 si no hay historia. */
  avgPrompts30d: number
  /** Solo los días con actividad, en orden ascendente. */
  days: PulseDay[]
}

export function dayFromMs(ms: number): string {
  const d = new Date(ms)
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mm}-${dd}`
}

/**
 * Aritmética de días sobre el calendario UTC: una etiqueta 'YYYY-MM-DD' ya no
 * tiene zona, y UTC no tiene horario de verano, así que sumar 86.4M ms nunca
 * salta ni repite un día. Hacerlo con `new Date(local)` sí lo haría.
 */
export function shiftDay(day: string, deltaDays: number): string {
  const [y, m, d] = day.split('-').map(Number)
  const t = Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1) + deltaDays * 86_400_000
  return new Date(t).toISOString().slice(0, 10)
}

function dayOfWeek(day: string): number {
  const [y, m, d] = day.split('-').map(Number)
  return new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1)).getUTCDay()
}

export function aggregatePulse(events: PulseEvent[], nowMs: number): PulseSnapshot {
  const today = dayFromMs(nowMs)
  const byDay = new Map<string, PulseDay>()
  let totalPrompts = 0
  let totalCommits = 0
  let totalTokens = 0

  for (const e of events) {
    const day = dayFromMs(e.ts)
    let cell = byDay.get(day)
    if (!cell) {
      cell = { day, prompts: 0, commits: 0 }
      byDay.set(day, cell)
    }
    if (e.kind === 'commit') {
      cell.commits++
      totalCommits++
    } else {
      cell.prompts++
      totalPrompts++
    }
    totalTokens += (e.tokensIn ?? 0) + (e.tokensOut ?? 0)
  }

  const days = [...byDay.values()].sort((a, b) => a.day.localeCompare(b.day))

  // Racha viva: cuenta hacia atrás desde hoy, o desde ayer si hoy aún no hay
  // nada — un día en curso sin actividad todavía no rompe la racha.
  let cursor = byDay.has(today) ? today : shiftDay(today, -1)
  let currentStreak = 0
  while (byDay.has(cursor)) {
    currentStreak++
    cursor = shiftDay(cursor, -1)
  }

  let longestStreak = 0
  let run = 0
  let prev: string | null = null
  for (const cell of days) {
    run = prev !== null && shiftDay(prev, 1) === cell.day ? run + 1 : 1
    if (run > longestStreak) longestStreak = run
    prev = cell.day
  }

  const from = shiftDay(today, -30)
  let prompts30d = 0
  for (const cell of days) {
    if (cell.day >= from && cell.day < today) prompts30d += cell.prompts
  }

  const todayCell = byDay.get(today)
  return {
    totalPrompts,
    totalCommits,
    totalTokens,
    todayPrompts: todayCell?.prompts ?? 0,
    todayCommits: todayCell?.commits ?? 0,
    currentStreak,
    longestStreak,
    avgPrompts30d: prompts30d / 30,
    days,
  }
}

export interface PulseCell {
  day: string
  prompts: number
  commits: number
}

/**
 * Grilla estilo GitHub: `weeks` columnas de 7 días (domingo→sábado), donde la
 * última columna es la semana que contiene `endDay`. Los días sin actividad
 * salen en cero, no se omiten — la grilla debe ser rectangular para pintarse.
 */
export function heatmapGrid(days: PulseDay[], endDay: string, weeks = 53): PulseCell[][] {
  const byDay = new Map(days.map(d => [d.day, d]))
  const lastSaturday = shiftDay(endDay, 6 - dayOfWeek(endDay))
  const start = shiftDay(lastSaturday, -(weeks * 7 - 1))
  const grid: PulseCell[][] = []
  for (let w = 0; w < weeks; w++) {
    const column: PulseCell[] = []
    for (let d = 0; d < 7; d++) {
      const day = shiftDay(start, w * 7 + d)
      const cell = byDay.get(day)
      column.push({ day, prompts: cell?.prompts ?? 0, commits: cell?.commits ?? 0 })
    }
    grid.push(column)
  }
  return grid
}

/**
 * Nivel de intensidad 0..4 de una celda, por cuantiles sobre los días activos.
 * Los umbrales fijos no sirven: quien hace 5 prompts al día vería todo en el
 * nivel 1 y quien hace 200 vería todo saturado.
 */
export function intensityLevels(values: number[]): number[] {
  const active = values.filter(v => v > 0).sort((a, b) => a - b)
  if (active.length === 0) return [0, 0, 0, 0]
  const at = (q: number): number => active[Math.min(active.length - 1, Math.floor(active.length * q))]!
  return [1, at(0.25), at(0.5), at(0.75)]
}

export function levelFor(value: number, thresholds: number[]): number {
  if (value <= 0) return 0
  let level = 1
  for (let i = 1; i < thresholds.length; i++) {
    if (value >= (thresholds[i] ?? Infinity)) level = i + 1
  }
  return level
}
