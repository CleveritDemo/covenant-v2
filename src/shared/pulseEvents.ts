/**
 * Pulse — agregación pura de la telemetría local.
 *
 * El store (`electron/pulseStore.ts`) solo hace append y lectura de un NDJSON;
 * toda la aritmética de rachas, totales y heatmap vive acá para poder testearla
 * sin Electron ni disco, igual que el resto de las máquinas de estado del app.
 */

/**
 * `delegate` y `result` son consecuencias de un turno, no actividad propia: solo
 * alimentan el corte por agente. Ver `aggregatePulse`.
 */
export type PulseEventKind = 'prompt' | 'commit' | 'delegate' | 'result'

export const PULSE_EVENT_KINDS: readonly PulseEventKind[] = ['prompt', 'commit', 'delegate', 'result']

export interface PulseEvent {
  /** epoch ms */
  ts: number
  kind: PulseEventKind
  /** basename del repo root, si el evento ocurrió dentro de uno. */
  repo?: string
  /** Rama activa en el repo al momento del evento. */
  branch?: string
  /**
   * Workspace org de la pestaña, como `<slug>/<workspaceId>`. Ausente en
   * pestañas personales — que es justamente la distinción que interesa medir.
   */
  workspace?: string
  /** CLI que atendió el turno (solo prompts). */
  provider?: string
  /**
   * Id del catálogo del agente. En un prompt es quien atendió el turno; en un
   * commit, el agente al que se le atribuye (los commits del panel Git no lo
   * llevan: los hizo la persona).
   */
  agentId?: string
  /** Nombre del catálogo al momento del evento; el roster lo prefiere al id. */
  agentName?: string
  /** Agente destino de una delegación (solo `delegate`). */
  toAgentId?: string
  /** Ask/Auto/Plan del turno: la postura de riesgo con la que se trabajó. */
  permissionMode?: string
  /** Tokens reportados por el CLI al cerrar el turno; `in` incluye la caché. */
  tokensIn?: number
  tokensOut?: number
  /** Pared del turno completo, incluidas las rondas de contexto (solo prompts). */
  durationMs?: number
  /**
   * El turno lo disparó un loop (self-loop del pane o cadena del plano), no una
   * persona escribiendo. Sigue siendo un turno: esto solo dice quién apretó.
   */
  viaLoop?: boolean
}

/** Etiqueta de workspace org que graba Pulse. `null` = pestaña personal. */
export function pulseWorkspaceTag(
  org: { slug?: string; workspaceId?: string } | null | undefined,
): string | null {
  const slug = org?.slug?.trim()
  const workspaceId = org?.workspaceId?.trim()
  return slug && workspaceId ? `${slug}/${workspaceId}` : null
}

const DELEG_BRANCH_PREFIX = 'gravity/deleg/'

/**
 * Quita SOLO el `repo` de eventos históricos mal etiquetados: el basename del
 * worktree de delegación (un GUID) se grabó como repo porque coincidía con el
 * sufijo de `gravity/deleg/<id>`. El repo padre no es recuperable desde la
 * bitácora, así que esos eventos siguen contando en totales pero dejan de
 * aparecer en el selector. Eventos nuevos (repo real + rama de delegación) no
 * coinciden y se dejan intactos.
 */
export function normalizePulseEvent(e: PulseEvent): PulseEvent {
  if (
    e.repo &&
    e.branch?.startsWith(DELEG_BRANCH_PREFIX) &&
    e.branch.slice(DELEG_BRANCH_PREFIX.length) === e.repo
  ) {
    const next = { ...e }
    delete next.repo
    return next
  }
  return e
}

export interface PulseDay {
  /** ISO YYYY-MM-DD en la tz local del equipo que grabó. */
  day: string
  prompts: number
  commits: number
}

export interface PulseStats {
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
  /** Una fila por agente que haya trabajado en el alcance, de más a menos turnos. */
  agents: PulseAgentStat[]
  /** Una fila por CLI que atendió turnos, de más a menos tokens. */
  providers: PulseProviderStat[]
}

export interface PulseSnapshot extends PulseStats {
  /**
   * Se calcula sobre la bitácora completa, no sobre el alcance: si saliera de
   * los eventos filtrados, elegir un workspace vaciaría el propio selector.
   */
  scopes: PulseScopeOptions
}

/**
 * Alcance de la vista. `workspace: PERSONAL_SCOPE` selecciona los eventos sin
 * workspace (pestañas personales), que es una selección distinta a "todos".
 */
export interface PulseScope {
  workspace?: string
  repo?: string
  /** Día ISO inclusive desde el que contar. */
  sinceDay?: string
}

/**
 * Sentinel para «pestañas sin workspace». Un NUL nunca aparece en un slug ni en
 * un id de workspace, así que no puede chocar con un valor real; va escapado y
 * no como byte crudo para que git siga viendo el archivo como texto.
 */
export const PERSONAL_SCOPE = '\0personal'

export interface PulseScopeOptions {
  workspaces: string[]
  repos: string[]
  /** Hay al menos un evento sin workspace: recién ahí ofrecer "Personal". */
  hasPersonal: boolean
}

export interface PulseAgentStat {
  agentId: string
  /** Nombre visible del último evento que lo traía; si no, se usa el id. */
  name?: string
  /** El del último turno: cambiar de CLI a mitad de camino es normal. */
  provider?: string
  turns: number
  /** Commits atribuidos al agente; no entran en `turns` ni en la serie. */
  commits: number
  /** Delegaciones que emitió (orquestador) y que recibió (ejecutor). */
  delegationsOut: number
  delegationsIn: number
  /** Bloques de resultados que escribió en `.gravity/results/`. */
  results: number
  /** Turnos disparados por un loop; subconjunto de `turns`, no se suma. */
  loopTurns: number
  tokens: number
  activeDays: number
  /** Media de duración de los turnos que la traen. 0 = ninguno la trae. */
  avgDurationMs: number
  lastTs: number
  /** Turnos por modo de permiso; `other` cubre eventos viejos sin el campo. */
  modes: { ask: number; plan: number; auto: number; other: number }
  /** Turnos por día en los últimos `seriesDays`, del más viejo al más nuevo. */
  series: number[]
  /** Repos tocados, de más a menos turnos. */
  repos: Array<{ repo: string; turns: number }>
}

export interface PulseProviderStat {
  provider: string
  turns: number
  tokensIn: number
  tokensOut: number
  tokens: number
  /**
   * Turnos con `(tokensIn ?? 0) + (tokensOut ?? 0) > 0`. Hoy solo algunos
   * harnesses reportan usage; sin este campo la UI no puede distinguir «gastó 0»
   * de «no sabemos» — pintar 0 donde no hay medición es mentir.
   */
  measuredTurns: number
  activeDays: number
  loopTurns: number
  avgDurationMs: number
  lastTs: number
  agents: Array<{ agentId: string; turns: number }>
}

export function filterPulseEvents(events: PulseEvent[], scope: PulseScope = {}): PulseEvent[] {
  const { workspace, repo, sinceDay } = scope
  if (!workspace && !repo && !sinceDay) return events
  return events.filter(e => {
    if (workspace === PERSONAL_SCOPE && e.workspace) return false
    if (workspace && workspace !== PERSONAL_SCOPE && e.workspace !== workspace) return false
    if (repo && e.repo !== repo) return false
    if (sinceDay && dayFromMs(e.ts) < sinceDay) return false
    return true
  })
}

export function pulseScopeOptions(events: PulseEvent[]): PulseScopeOptions {
  const workspaces = new Set<string>()
  const repos = new Set<string>()
  let hasPersonal = false
  for (const e of events) {
    if (e.workspace) workspaces.add(e.workspace)
    else hasPersonal = true
    if (e.repo) repos.add(e.repo)
  }
  return {
    workspaces: [...workspaces].sort(),
    repos: [...repos].sort(),
    hasPersonal,
  }
}

/**
 * Corte por agente de los mismos eventos que alimentan el heatmap: la sección
 * "Agentic engineering" no mide otra población, mira la misma con otra lente.
 *
 * Los commits solo entran si traen `agentId` (los del panel Git son de la
 * persona) y cuentan aparte: no son turnos ni tocan la serie ni los tokens.
 */
export function aggregateAgents(
  events: PulseEvent[],
  nowMs: number,
  seriesDays = 30,
): PulseAgentStat[] {
  interface Acc extends PulseAgentStat {
    days: Set<string>
    repoTurns: Map<string, number>
    durationMsTotal: number
    timedTurns: number
  }
  const byAgent = new Map<string, Acc>()
  const seriesStart = shiftDay(dayFromMs(nowMs), -(seriesDays - 1))

  const ensure = (agentId: string): Acc => {
    let row = byAgent.get(agentId)
    if (!row) {
      row = {
        agentId,
        turns: 0,
        commits: 0,
        loopTurns: 0,
        delegationsOut: 0,
        delegationsIn: 0,
        results: 0,
        tokens: 0,
        activeDays: 0,
        avgDurationMs: 0,
        lastTs: 0,
        modes: { ask: 0, plan: 0, auto: 0, other: 0 },
        series: new Array(seriesDays).fill(0),
        repos: [],
        days: new Set(),
        repoTurns: new Map(),
        durationMsTotal: 0,
        timedTurns: 0,
      }
      byAgent.set(agentId, row)
    }
    return row
  }

  for (const e of events) {
    // Una delegación nombra a dos agentes y puede ser la única noticia que
    // tengamos del destino, así que su fila se crea acá y no solo con turnos.
    if (e.kind === 'delegate') {
      if (e.agentId) ensure(e.agentId).delegationsOut++
      if (e.toAgentId) ensure(e.toAgentId).delegationsIn++
      continue
    }
    if (!e.agentId) continue
    const row = ensure(e.agentId)
    if (e.agentName?.trim()) row.name = e.agentName.trim()
    if (e.kind === 'result') {
      row.results++
      continue
    }
    const day = dayFromMs(e.ts)
    if (e.kind === 'commit') {
      row.commits++
      row.days.add(day)
      if (e.ts >= row.lastTs) row.lastTs = e.ts
      continue
    }
    row.turns++
    if (e.viaLoop) row.loopTurns++
    if (typeof e.durationMs === 'number' && e.durationMs >= 0) {
      row.durationMsTotal += e.durationMs
      row.timedTurns++
    }
    row.tokens += (e.tokensIn ?? 0) + (e.tokensOut ?? 0)
    row.days.add(day)
    if (e.ts >= row.lastTs) {
      row.lastTs = e.ts
      if (e.provider) row.provider = e.provider
    }
    const mode = e.permissionMode
    if (mode === 'ask' || mode === 'plan' || mode === 'auto') row.modes[mode]++
    else row.modes.other++
    if (e.repo) row.repoTurns.set(e.repo, (row.repoTurns.get(e.repo) ?? 0) + 1)
    if (day >= seriesStart) {
      const slot = seriesDays - 1 - daysBetween(day, dayFromMs(nowMs))
      if (slot >= 0 && slot < seriesDays) row.series[slot]!++
    }
  }

  return [...byAgent.values()]
    .map(({ days, repoTurns, durationMsTotal, timedTurns, ...row }) => ({
      ...row,
      activeDays: days.size,
      avgDurationMs: timedTurns > 0 ? durationMsTotal / timedTurns : 0,
      repos: [...repoTurns.entries()]
        .map(([repo, turns]) => ({ repo, turns }))
        .sort((a, b) => b.turns - a.turns),
    }))
    .sort((a, b) => b.turns - a.turns || a.agentId.localeCompare(b.agentId))
}

/**
 * Corte por CLI de los turnos prompt: commit, delegate y result no traen harness;
 * los prompts sin `provider` quedan fuera igual que en la instrumentación.
 */
export function aggregateProviders(events: PulseEvent[], nowMs: number): PulseProviderStat[] {
  interface Acc {
    provider: string
    turns: number
    tokensIn: number
    tokensOut: number
    tokens: number
    measuredTurns: number
    loopTurns: number
    lastTs: number
    days: Set<string>
    durationMsTotal: number
    timedTurns: number
    agentTurns: Map<string, number>
  }
  const byProvider = new Map<string, Acc>()

  const ensure = (provider: string): Acc => {
    let row = byProvider.get(provider)
    if (!row) {
      row = {
        provider,
        turns: 0,
        tokensIn: 0,
        tokensOut: 0,
        tokens: 0,
        measuredTurns: 0,
        loopTurns: 0,
        lastTs: 0,
        days: new Set(),
        durationMsTotal: 0,
        timedTurns: 0,
        agentTurns: new Map(),
      }
      byProvider.set(provider, row)
    }
    return row
  }

  for (const e of events) {
    if (e.kind !== 'prompt') continue
    const provider = e.provider?.trim()
    if (!provider) continue
    const row = ensure(provider)
    row.turns++
    if (e.viaLoop) row.loopTurns++
    const tokensIn = e.tokensIn ?? 0
    const tokensOut = e.tokensOut ?? 0
    row.tokensIn += tokensIn
    row.tokensOut += tokensOut
    row.tokens += tokensIn + tokensOut
    if (tokensIn + tokensOut > 0) row.measuredTurns++
    if (typeof e.durationMs === 'number' && e.durationMs >= 0) {
      row.durationMsTotal += e.durationMs
      row.timedTurns++
    }
    row.days.add(dayFromMs(e.ts))
    if (e.ts >= row.lastTs) row.lastTs = e.ts
    if (e.agentId) row.agentTurns.set(e.agentId, (row.agentTurns.get(e.agentId) ?? 0) + 1)
  }

  return [...byProvider.values()]
    .map(({ days, durationMsTotal, timedTurns, agentTurns, ...row }) => ({
      ...row,
      activeDays: days.size,
      avgDurationMs: timedTurns > 0 ? durationMsTotal / timedTurns : 0,
      agents: [...agentTurns.entries()]
        .map(([agentId, turns]) => ({ agentId, turns }))
        .sort((a, b) => b.turns - a.turns || a.agentId.localeCompare(b.agentId)),
    }))
    .sort((a, b) => b.tokens - a.tokens || b.turns - a.turns || a.provider.localeCompare(b.provider))
}

/** Días enteros entre dos etiquetas ISO, sobre el calendario UTC como shiftDay. */
function daysBetween(from: string, to: string): number {
  const ms = (day: string): number => {
    const [y, m, d] = day.split('-').map(Number)
    return Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1)
  }
  return Math.round((ms(to) - ms(from)) / 86_400_000)
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

export function aggregatePulse(events: PulseEvent[], nowMs: number): PulseStats {
  const today = dayFromMs(nowMs)
  const byDay = new Map<string, PulseDay>()
  let totalPrompts = 0
  let totalCommits = 0
  let totalTokens = 0

  for (const e of events) {
    // Solo prompt y commit son actividad del calendario. Delegaciones y
    // resultados son consecuencia de un turno que ya se contó: sumarlos
    // inflaría el heatmap y, peor, crearía días activos que estirarían la racha.
    if (e.kind !== 'prompt' && e.kind !== 'commit') continue
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
    agents: aggregateAgents(events, nowMs),
    providers: aggregateProviders(events, nowMs),
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
