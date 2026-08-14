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

export function activeThreadOf(state: AgentThreadState): AgentThread | undefined {
  return state.threads.find(thread => thread.id === state.activeThreadId)
}

/** Más recientes primero; los sin estrenar (updatedAt 0) quedan al final. */
export function sortThreadsByRecency(threads: readonly AgentThread[]): AgentThread[] {
  return [...threads].sort((a, b) => b.updatedAt - a.updatedAt)
}

/**
 * Tope duro de threads por pane. El activo nunca se poda.
 * ponytail: el transcript del thread podado queda huérfano en disco hasta que
 * se cierra el pane (que borra la carpeta entera). Son kilobytes de texto;
 * barrer por archivo pide un cruce disco↔sesión que hoy no paga.
 */
function prune(
  threads: readonly AgentThread[],
  activeThreadId: string,
  protectedIds?: ReadonlySet<string>,
): AgentThread[] {
  if (threads.length <= MAX_THREADS_PER_PANE) return [...threads]
  const protectedSet = new Set(protectedIds ?? [])
  protectedSet.add(activeThreadId)
  const keep = new Set(
    sortThreadsByRecency(threads)
      .filter(thread => thread.id !== activeThreadId && !protectedSet.has(thread.id))
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

export function selectThread(state: AgentThreadState, id: string): AgentThreadState {
  if (id === state.activeThreadId) return state
  if (!state.threads.some(thread => thread.id === id)) return state
  return { ...state, activeThreadId: id }
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
