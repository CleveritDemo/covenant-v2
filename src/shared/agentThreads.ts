/**
 * Threads de conversación de un pane de agente.
 *
 * Gravity nunca guardó la memoria del modelo: la guarda el CLI en su propio
 * store, y `--resume <cliSessionId>` la recupera. Lo único que faltaba era
 * recordar más de un puntero a la vez.
 *
 * El `id` del thread es local y nace antes que el `cliSessionId` (el CLI lo
 * emite recién en la primera respuesta), así que es el thread —y no la sesión
 * del CLI— quien es dueño del transcript en disco. Si el `--resume` falla, el
 * thread sigue existiendo con su historial.
 */

export interface AgentThread {
  id: string
  /** Derivado del primer mensaje del usuario. Vacío = thread sin estrenar. */
  title: string
  cliSessionId?: string
  /** epoch ms del último turno: ordena la lista y decide a quién podar. */
  updatedAt: number
  /** Origen del hilo: humano o delegación entrante. */
  origin?: 'human' | 'delegation'
  /** Id de delegación que abrió el hilo (solo origin delegation). */
  delegationId?: string
}

export interface AgentThreadState {
  threads: AgentThread[]
  activeThreadId: string
}

/** Thread al que migran los bindings pre-threads (y su transcript plano). */
export const DEFAULT_THREAD_ID = 't1'
export const MAX_THREADS_PER_PANE = 20
/** Hilos recientes visibles en chips junto al activo (el activo no cuenta). */
export const MAX_RECENT_CHIP_THREADS = 5
export const THREAD_TITLE_MAX = 48

/** Los ids terminan en un path (`agent-chats/<pane>/<thread>.json`). */
const ID_RE = /^[A-Za-z0-9_-]{1,64}$/

export function isThreadId(value: unknown): value is string {
  return typeof value === 'string' && ID_RE.test(value)
}

export function threadTitleFrom(text: string): string {
  const flat = text.replace(/\s+/g, ' ').trim()
  if (flat.length <= THREAD_TITLE_MAX) return flat
  return `${flat.slice(0, THREAD_TITLE_MAX - 1).trimEnd()}…`
}

/** Espacios y caracteres de ancho cero que dejan el título visualmente vacío. */
const INVISIBLE_THREAD_TITLE_RE = /[\s\u200B-\u200D\uFEFF]/g

export function threadTitleHasVisibleText(title: string): boolean {
  return title.replace(INVISIBLE_THREAD_TITLE_RE, '').length > 0
}

/** Título visible en UI o etiqueta de respaldo cuando el hilo no tiene nombre útil. */
export function threadDisplayTitleOr(title: string, fallback: string): string {
  const raw = title.trim()
  if (!threadTitleHasVisibleText(raw)) return fallback
  return raw
}

export function activeThreadOf(state: AgentThreadState): AgentThread | undefined {
  return state.threads.find(thread => thread.id === state.activeThreadId)
}

/** Más recientes primero; los sin estrenar (updatedAt 0) quedan al final. */
export function sortThreadsByRecency(threads: readonly AgentThread[]): AgentThread[] {
  return [...threads].sort((a, b) => b.updatedAt - a.updatedAt)
}

/**
 * Candidatos a chips e historial: humanos + delegaciones en curso; sin el
 * activo; más recientes primero.
 */
export function threadBarCandidates(
  threads: readonly AgentThread[],
  activeThreadId?: string,
  runningThreadIds?: readonly string[],
): AgentThread[] {
  const running = new Set(runningThreadIds ?? [])
  const visible = threads.filter(
    thread => isHumanThread(thread) || running.has(thread.id),
  )
  const sorted = sortThreadsByRecency(visible)
  const active = activeThreadId?.trim()
  if (!active) return sorted
  return sorted.filter(thread => thread.id !== active)
}

/** Hasta MAX_RECENT_CHIP_THREADS hilos recientes para chips (sin el activo). */
export function recentChipThreads(
  threads: readonly AgentThread[],
  activeThreadId: string,
  runningThreadIds: readonly string[],
  limit = MAX_RECENT_CHIP_THREADS,
): AgentThread[] {
  return threadBarCandidates(threads, activeThreadId, runningThreadIds).slice(0, limit)
}

/**
 * Chips de la barra: el activo (recién abierto / en vista) siempre a la
 * izquierda; el resto por `updatedAt` desc. Abrir llama `selectThreadOpened`
 * y sube `updatedAt`; el pin evita que un carril de fondo lo desplace.
 */
export function barChipThreads(
  threads: readonly AgentThread[],
  activeThreadId: string,
  runningThreadIds: readonly string[],
  limit = MAX_RECENT_CHIP_THREADS,
): AgentThread[] {
  const recent = recentChipThreads(threads, activeThreadId, runningThreadIds, limit)
  const active = activeThreadId
    ? threads.find(thread => thread.id === activeThreadId)
    : undefined
  return active ? [active, ...recent] : recent
}

/** Hilos que ocupan chips en la barra: activo + los recientes visibles. */
export function chipVisibleThreadIds(
  threads: readonly AgentThread[],
  activeThreadId: string,
  runningThreadIds: readonly string[],
): Set<string> {
  const ids = new Set<string>()
  for (const thread of barChipThreads(threads, activeThreadId, runningThreadIds)) {
    ids.add(thread.id)
  }
  return ids
}

/**
 * Hilos del popover: candidatos que no caben en los chips recientes.
 *
 * Los carriles de delegación terminados no entran: son transcripts de
 * subtareas, sin título y sin nada que la persona haya escrito, y en una ola
 * grande sepultaban las conversaciones reales. Los que siguen corriendo sí,
 * que es la misma regla que usan los nodos de hilo de la card.
 */
export function threadHistoryCandidates(
  threads: readonly AgentThread[],
  activeThreadId?: string,
  runningThreadIds?: readonly string[],
): AgentThread[] {
  return threadBarCandidates(threads, activeThreadId, runningThreadIds)
    .slice(MAX_RECENT_CHIP_THREADS)
}

export function paginateThreadHistory(
  candidates: readonly AgentThread[],
  limit: number,
): { items: AgentThread[]; hasMore: boolean } {
  const safeLimit = Math.max(0, Math.floor(limit))
  const items = candidates.slice(0, safeLimit)
  return { items, hasMore: candidates.length > safeLimit }
}

/** Popover: carriles de delegación primero; conversaciones humanas después. */
export function splitThreadHistoryCandidates(
  threads: readonly AgentThread[],
  activeThreadId?: string,
  runningThreadIds?: readonly string[],
): { delegations: AgentThread[]; humans: AgentThread[] } {
  const candidates = threadHistoryCandidates(threads, activeThreadId, runningThreadIds)
  const delegations: AgentThread[] = []
  const humans: AgentThread[] = []
  for (const thread of candidates) {
    if (thread.origin === 'delegation') delegations.push(thread)
    else humans.push(thread)
  }
  return { delegations, humans }
}

/**
 * Tope duro de threads por pane. El activo nunca se poda.
 * El transcript del thread podado queda huérfano en disco hasta el próximo
 * arranque: `sweepOrphanAgentChats` (electron/persistence.ts) hace ese cruce
 * disco↔sesión una vez, cuando no hay carriles vivos que confundir.
 */
function prune(
  threads: readonly AgentThread[],
  activeThreadId: string,
  protectedIds?: ReadonlySet<string>,
): AgentThread[] {
  if (threads.length <= MAX_THREADS_PER_PANE) return [...threads]
  const protectedSet = new Set(protectedIds ?? [])
  protectedSet.add(activeThreadId)
  // Los hilos de delegación se van antes que los humanos: son transcripts de
  // subtareas (sin título, invisibles para la persona) y en una ola grande
  // llenan el cupo en minutos. Ordenar solo por recencia expulsaba las
  // conversaciones del usuario y dejaba veinte carriles de máquina.
  const candidates = [...sortThreadsByRecency(threads)]
    .filter(thread => thread.id !== activeThreadId && !protectedSet.has(thread.id))
    .sort((a, b) => Number(isHumanThread(b)) - Number(isHumanThread(a)))
  const keep = new Set(
    candidates
      .slice(0, MAX_THREADS_PER_PANE - 1)
      .map(thread => thread.id),
  )
  for (const id of protectedSet) keep.add(id)
  return threads.filter(thread => keep.has(thread.id))
}

function sanitizeThread(raw: unknown): AgentThread | null {
  if (!raw || typeof raw !== 'object') return null
  const data = raw as Record<string, unknown>
  if (!isThreadId(data.id)) return null
  const cliSessionId = typeof data.cliSessionId === 'string' && data.cliSessionId.trim()
    ? data.cliSessionId.trim()
    : undefined
  const origin = data.origin === 'human' || data.origin === 'delegation'
    ? data.origin
    : undefined
  const delegationId = typeof data.delegationId === 'string' && data.delegationId.trim()
    ? data.delegationId.trim()
    : undefined
  return {
    id: data.id,
    title: typeof data.title === 'string' ? threadTitleFrom(data.title) : '',
    updatedAt: typeof data.updatedAt === 'number' && Number.isFinite(data.updatedAt)
      ? Math.max(0, Math.floor(data.updatedAt))
      : 0,
    ...(cliSessionId ? { cliSessionId } : {}),
    ...(origin ? { origin } : {}),
    ...(delegationId ? { delegationId } : {}),
  }
}

/**
 * Normaliza a un estado siempre válido: al menos un thread y un activo que
 * existe. `legacyCliSessionId` es el campo suelto del binding pre-threads.
 */
export function sanitizeThreadState(
  rawThreads: unknown,
  rawActiveThreadId: unknown,
  legacyCliSessionId?: string,
  protectedIds?: ReadonlySet<string>,
): AgentThreadState {
  const threads: AgentThread[] = []
  const seen = new Set<string>()
  for (const raw of Array.isArray(rawThreads) ? rawThreads : []) {
    const thread = sanitizeThread(raw)
    if (!thread || seen.has(thread.id)) continue
    seen.add(thread.id)
    threads.push(thread)
  }
  if (threads.length === 0) {
    const session = legacyCliSessionId?.trim()
    threads.push({
      id: DEFAULT_THREAD_ID,
      title: '',
      updatedAt: 0,
      ...(session ? { cliSessionId: session } : {}),
    })
  }
  const activeThreadId = isThreadId(rawActiveThreadId)
    && threads.some(thread => thread.id === rawActiveThreadId)
    ? rawActiveThreadId
    : threads[threads.length - 1]!.id
  return { threads: prune(threads, activeThreadId, protectedIds), activeThreadId }
}

/**
 * Proyección del estado sobre `AgentPaneMeta`. El `cliSessionId` sale del
 * thread activo: al cambiar de conversación el pane tiene que reanudar la
 * sesión de *esa*, no arrastrar la que venía en el meta anterior.
 */
export function threadPatch(state: AgentThreadState): AgentThreadState & {
  cliSessionId: string | undefined
} {
  return { ...state, cliSessionId: activeThreadOf(state)?.cliSessionId }
}

export function newThread(
  state: AgentThreadState,
  id: string,
  now: number,
  protectedIds?: ReadonlySet<string>,
): AgentThreadState {
  if (!isThreadId(id) || state.threads.some(thread => thread.id === id)) return state
  const threads = [...state.threads, { id, title: '', updatedAt: now }]
  return { threads: prune(threads, id, protectedIds), activeThreadId: id }
}

export function isHumanThread(thread: AgentThread): boolean {
  return thread.origin !== 'delegation'
}

/** Hilos humanos (o legacy sin origin), más recientes primero. */
export function humanThreadsByRecency(state: AgentThreadState): AgentThread[] {
  return sortThreadsByRecency(state.threads.filter(isHumanThread))
}

/**
 * Hilo por defecto al abrir la card: última interacción humana (updatedAt),
 * incluyendo aperturas recientes vía `selectThreadOpened`.
 */
export function resolvePreferredHumanThreadId(state: AgentThreadState): string {
  const humans = humanThreadsByRecency(state)
  if (humans.length > 0) return humans[0]!.id
  const legacy = state.threads.find(thread => thread.id === DEFAULT_THREAD_ID)
  if (legacy) return legacy.id
  return state.threads[0]?.id ?? DEFAULT_THREAD_ID
}

/**
 * Hilo al abrir la card mini vía clic en fila de hilo en curso.
 * Clic en el resto de la card → `resolvePreferredHumanThreadId` (App).
 */
export function resolveCardOpenThreadId(
  state: AgentThreadState,
  runningThreadIds: readonly string[],
): string {
  const running = new Set(runningThreadIds)
  const runningHumans = humanThreadsByRecency(state).filter(thread => running.has(thread.id))
  if (runningHumans.length > 0) {
    return runningHumans[0]!.id
  }
  return resolvePreferredHumanThreadId(state)
}

/** Marca apertura/selección: actualiza updatedAt para ordenar la próxima apertura. */
export function markThreadOpened(
  state: AgentThreadState,
  id: string,
  now: number,
): AgentThreadState {
  const thread = state.threads.find(entry => entry.id === id)
  if (!thread) return state
  if (thread.updatedAt === now) return state
  return {
    ...state,
    threads: state.threads.map(entry => (
      entry.id === id ? { ...entry, updatedAt: now } : entry
    )),
  }
}

export function selectThread(state: AgentThreadState, id: string): AgentThreadState {
  if (id === state.activeThreadId) return state
  if (!state.threads.some(thread => thread.id === id)) return state
  return { ...state, activeThreadId: id }
}

/** Selecciona y registra apertura (card, fila de hilo, selector del composer). */
export function selectThreadOpened(
  state: AgentThreadState,
  id: string,
  now: number,
): AgentThreadState {
  if (!state.threads.some(thread => thread.id === id)) return state
  const activated = state.activeThreadId === id
    ? state
    : { ...state, activeThreadId: id }
  return markThreadOpened(activated, id, now)
}

/**
 * Borra un thread. Si era el último, deja uno nuevo y vacío con `fallbackId`
 * (un pane siempre tiene una conversación donde escribir).
 */
/**
 * Borra hilos de delegación completados. Solo toca `origin === 'delegation'`.
 * Si el activo es uno de ellos, salta al hilo humano más reciente antes de
 * borrar; si no queda ninguno, `deleteThread` deja un hilo vacío de respaldo.
 */
export function pruneCompletedDelegationThreads(
  state: AgentThreadState,
  delegationThreadIds: readonly string[],
  fallbackId: string,
  now: number,
): { state: AgentThreadState; deletedIds: string[] } {
  const deletedIds: string[] = []
  let next = state
  const targetIds = [
    ...new Set(delegationThreadIds.map(id => id.trim()).filter(Boolean)),
  ]

  for (const threadId of targetIds) {
    const thread = next.threads.find(entry => entry.id === threadId)
    if (!thread || thread.origin !== 'delegation') continue

    if (next.activeThreadId === threadId) {
      const humanThreads = sortThreadsByRecency(
        next.threads.filter(entry => entry.origin !== 'delegation'),
      )
      if (humanThreads.length > 0) {
        next = { ...next, activeThreadId: humanThreads[0]!.id }
      }
    }

    const hadThread = next.threads.some(entry => entry.id === threadId)
    next = deleteThread(next, threadId, fallbackId, now)
    if (hadThread && !next.threads.some(entry => entry.id === threadId)) {
      deletedIds.push(threadId)
    }
  }

  return { state: next, deletedIds }
}

export function deleteThread(
  state: AgentThreadState,
  id: string,
  fallbackId: string,
  now: number,
): AgentThreadState {
  const threads = state.threads.filter(thread => thread.id !== id)
  if (threads.length === state.threads.length) return state
  if (threads.length === 0) {
    return newThread({ threads: [], activeThreadId: '' }, fallbackId, now)
  }
  if (id !== state.activeThreadId) return { ...state, threads }
  return { threads, activeThreadId: sortThreadsByRecency(threads)[0]!.id }
}

/**
 * Fija (o borra, con `undefined`) el `cliSessionId` del thread activo.
 * Es el puente con `AgentPaneMeta.cliSessionId`, que sigue siendo lo que lee
 * el runtime del turno.
 */
export function setActiveThreadSession(
  state: AgentThreadState,
  cliSessionId: string | undefined,
): AgentThreadState {
  const current = activeThreadOf(state)
  if (!current || current.cliSessionId === cliSessionId) return state
  const { cliSessionId: _dropped, ...rest } = current
  const next: AgentThread = { ...rest, ...(cliSessionId ? { cliSessionId } : {}) }
  return {
    ...state,
    threads: state.threads.map(thread => (thread.id === state.activeThreadId ? next : thread)),
  }
}

/**
 * Retitula un thread. Un título vacío se ignora: dejarlo en blanco haría que
 * `touchActiveThread` lo volviera a autotitular en el turno siguiente.
 */
export function renameThread(
  state: AgentThreadState,
  id: string,
  title: string,
): AgentThreadState {
  const next = threadTitleFrom(title)
  if (!next) return state
  const current = state.threads.find(thread => thread.id === id)
  if (!current || current.title === next) return state
  return {
    ...state,
    threads: state.threads.map(thread => (
      thread.id === id ? { ...thread, title: next } : thread
    )),
  }
}

/** Marca actividad en el thread activo y le pone título si aún no tenía. */
export function touchActiveThread(
  state: AgentThreadState,
  title: string,
  now: number,
): AgentThreadState {
  const current = activeThreadOf(state)
  if (!current) return state
  const next: AgentThread = {
    ...current,
    title: current.title || threadTitleFrom(title),
    updatedAt: now,
  }
  return {
    ...state,
    threads: state.threads.map(thread => (thread.id === state.activeThreadId ? next : thread)),
  }
}

/** Workspaces org: el historial viaja, la sesión CLI no (es local al usuario). */
export function stripThreadSessions(threads: readonly AgentThread[]): AgentThread[] {
  return threads.map(thread => {
    if (!thread.cliSessionId) return thread
    const { cliSessionId: _dropped, ...rest } = thread
    return rest
  })
}
