import { describe, expect, it } from 'vitest'
import {
  DEFAULT_THREAD_ID,
  MAX_THREADS_PER_PANE,
  MAX_RECENT_CHIP_THREADS,
  barChipThreads,
  chipVisibleThreadIds,
  delegationThreadIdsForDelegationIds,
  deleteThread,
  newThread,
  paginateThreadHistory,
  pruneCompletedDelegationThreads,
  renameThread,
  resolveCardOpenThreadId,
  resolvePreferredHumanThreadId,
  sanitizeThreadState,
  selectThread,
  selectThreadOpened,
  setActiveThreadSession,
  sortThreadsByRecency,
  stripThreadSessions,
  splitThreadHistoryCandidates,
  recentChipThreads,
  threadBarCandidates,
  threadHistoryCandidates,
  threadPatch,
  threadTitleFrom,
  threadTitleHasVisibleText,
  threadDisplayTitleOr,
  touchActiveThread,
} from '../agentThreads'

describe('threadTitleFrom', () => {
  it('colapsa espacios y recorta', () => {
    expect(threadTitleFrom('  hola\n  como   estas? ')).toBe('hola como estas?')
    expect(threadTitleFrom('x'.repeat(80))).toHaveLength(48)
    expect(threadTitleFrom('x'.repeat(80)).endsWith('…')).toBe(true)
  })
})

describe('threadDisplayTitleOr', () => {
  it('usa el fallback con título vacío o solo espacios invisibles', () => {
    expect(threadDisplayTitleOr('', 'Sin título')).toBe('Sin título')
    expect(threadDisplayTitleOr('   ', 'Sin título')).toBe('Sin título')
    expect(threadDisplayTitleOr('\u200B', 'Sin título')).toBe('Sin título')
    expect(threadDisplayTitleOr('  Mi hilo  ', 'Sin título')).toBe('Mi hilo')
  })

  it('threadTitleHasVisibleText ignora espacios y zero-width', () => {
    expect(threadTitleHasVisibleText('')).toBe(false)
    expect(threadTitleHasVisibleText('\u200B')).toBe(false)
    expect(threadTitleHasVisibleText('a')).toBe(true)
  })
})

describe('sanitizeThreadState', () => {
  it('migra el cliSessionId suelto de un binding pre-threads', () => {
    const state = sanitizeThreadState(undefined, undefined, 'sess-1')
    expect(state.activeThreadId).toBe(DEFAULT_THREAD_ID)
    expect(state.threads).toEqual([
      { id: DEFAULT_THREAD_ID, title: '', updatedAt: 0, cliSessionId: 'sess-1' },
    ])
  })

  it('siempre deja un thread y un activo válido', () => {
    const state = sanitizeThreadState([], 'no-existe')
    expect(state.threads).toHaveLength(1)
    expect(state.activeThreadId).toBe(state.threads[0]!.id)
  })

  it('descarta ids inservibles como path y duplicados', () => {
    const state = sanitizeThreadState(
      [
        { id: '../escape', title: 'a', updatedAt: 1 },
        { id: 'ok', title: 'b', updatedAt: 2 },
        { id: 'ok', title: 'duplicado', updatedAt: 3 },
      ],
      'ok',
    )
    expect(state.threads.map(thread => thread.id)).toEqual(['ok'])
    expect(state.threads[0]!.title).toBe('b')
  })

  it('poda al tope sin tocar el activo', () => {
    const raw = Array.from({ length: MAX_THREADS_PER_PANE + 5 }, (_, index) => ({
      id: `t${index}`,
      title: '',
      updatedAt: index,
    }))
    const state = sanitizeThreadState(raw, 't0')
    expect(state.threads).toHaveLength(MAX_THREADS_PER_PANE)
    expect(state.threads.some(thread => thread.id === 't0')).toBe(true)
    // Se van los más viejos, no el activo.
    expect(state.threads.some(thread => thread.id === 't1')).toBe(false)
  })

  it('expulsa hilos de delegación antes que conversaciones humanas', () => {
    // Una ola grande llena el cupo con carriles de máquina; si la poda mira
    // solo recencia, el usuario pierde sus propias conversaciones.
    const human = Array.from({ length: 4 }, (_, index) => ({
      id: `h${index}`,
      title: `humano ${index}`,
      updatedAt: index,
    }))
    const delegations = Array.from({ length: MAX_THREADS_PER_PANE }, (_, index) => ({
      id: `d${index}`,
      title: '',
      updatedAt: 1_000 + index,
      origin: 'delegation' as const,
    }))
    const state = sanitizeThreadState([...human, ...delegations], 'h0')
    expect(state.threads).toHaveLength(MAX_THREADS_PER_PANE)
    for (const thread of human) {
      expect(state.threads.some(kept => kept.id === thread.id)).toBe(true)
    }
    // Los carriles más viejos son los que se van, aunque sean más recientes
    // que cualquier hilo humano.
    expect(state.threads.some(kept => kept.id === 'd0')).toBe(false)
  })

  it('protectedIds no se podan aunque superen MAX_THREADS_PER_PANE', () => {
    const raw = Array.from({ length: MAX_THREADS_PER_PANE + 3 }, (_, index) => ({
      id: `t${index}`,
      title: '',
      updatedAt: index,
    }))
    const protectedIds = new Set(['t99'])
    const withExtra = [
      ...raw,
      { id: 't99', title: 'protegido', updatedAt: 999 },
    ]
    const state = sanitizeThreadState(withExtra, 't0', undefined, protectedIds)
    expect(state.threads.some(thread => thread.id === 't99')).toBe(true)
    expect(state.threads.some(thread => thread.id === 't0')).toBe(true)
  })

  it('la poda conserva hilos con carril vivo aunque excedan MAX_THREADS_PER_PANE', () => {
    const raw = Array.from({ length: MAX_THREADS_PER_PANE + 2 }, (_, index) => ({
      id: `t${index}`,
      title: `thread ${index}`,
      updatedAt: index,
    }))
    const liveLaneId = 't-live-lane'
    const withLane = [
      ...raw,
      { id: liveLaneId, title: 'delegación activa', updatedAt: 999, origin: 'delegation' as const },
    ]
    const protectedIds = new Set([liveLaneId])
    const state = sanitizeThreadState(withLane, 't0', undefined, protectedIds)
    expect(state.threads.some(thread => thread.id === liveLaneId)).toBe(true)
    expect(state.threads.length).toBeLessThanOrEqual(MAX_THREADS_PER_PANE + 1)
  })

  it('origin y delegationId sobreviven al sanitize', () => {
    const state = sanitizeThreadState(
      [{
        id: 'd1',
        title: 'deleg',
        updatedAt: 1,
        origin: 'delegation',
        delegationId: 'del-42',
      }],
      'd1',
    )
    expect(state.threads[0]).toMatchObject({
      origin: 'delegation',
      delegationId: 'del-42',
    })
    const bad = sanitizeThreadState(
      [{ id: 'x', title: '', updatedAt: 0, origin: 'bot', delegationId: '  ' }],
      'x',
    )
    expect(bad.threads[0]!.origin).toBeUndefined()
    expect(bad.threads[0]!.delegationId).toBeUndefined()
  })
})

describe('operaciones', () => {
  const base = sanitizeThreadState(
    [
      { id: 'a', title: 'vieja', updatedAt: 10 },
      { id: 'b', title: 'nueva', updatedAt: 20, cliSessionId: 'sess-b' },
    ],
    'a',
  )

  it('newThread activa el nuevo y no borra el anterior', () => {
    const next = newThread(base, 'c', 30)
    expect(next.activeThreadId).toBe('c')
    expect(next.threads.map(thread => thread.id)).toEqual(['a', 'b', 'c'])
  })

  it('selectThread ignora ids que no existen', () => {
    expect(selectThread(base, 'zzz')).toBe(base)
    expect(selectThread(base, 'b').activeThreadId).toBe('b')
  })

  it('deleteThread del activo salta al más reciente', () => {
    const next = deleteThread(base, 'a', 'fallback', 40)
    expect(next.threads.map(thread => thread.id)).toEqual(['b'])
    expect(next.activeThreadId).toBe('b')
  })

  it('deleteThread del último deja uno vacío', () => {
    const one = sanitizeThreadState([{ id: 'a', title: 'x', updatedAt: 1 }], 'a')
    const next = deleteThread(one, 'a', 'fresh', 40)
    expect(next.threads).toEqual([{ id: 'fresh', title: '', updatedAt: 40 }])
    expect(next.activeThreadId).toBe('fresh')
  })

  it('setActiveThreadSession fija y borra la sesión del activo', () => {
    const withSession = setActiveThreadSession(base, 'sess-a')
    expect(withSession.threads[0]!.cliSessionId).toBe('sess-a')
    const cleared = setActiveThreadSession(withSession, undefined)
    expect(cleared.threads[0]!.cliSessionId).toBeUndefined()
    // El thread inactivo conserva la suya.
    expect(cleared.threads[1]!.cliSessionId).toBe('sess-b')
  })

  it('touchActiveThread titula una sola vez', () => {
    const fresh = newThread(base, 'c', 30)
    const first = touchActiveThread(fresh, 'arreglar el login', 31)
    const second = touchActiveThread(first, 'y ahora el logout', 32)
    const active = second.threads.find(thread => thread.id === 'c')!
    expect(active.title).toBe('arreglar el login')
    expect(active.updatedAt).toBe(32)
  })

  it('renameThread ignora vacíos y no toca los demás', () => {
    expect(renameThread(base, 'a', '   ')).toBe(base)
    expect(renameThread(base, 'no-existe', 'x')).toBe(base)
    const next = renameThread(base, 'a', '  refactor  del   login ')
    expect(next.threads[0]!.title).toBe('refactor del login')
    expect(next.threads[1]!.title).toBe('nueva')
  })

  it('el título puesto a mano sobrevive al turno siguiente', () => {
    const renamed = renameThread(base, 'a', 'mi hilo')
    const after = touchActiveThread(renamed, 'otro mensaje cualquiera', 99)
    expect(after.threads[0]!.title).toBe('mi hilo')
  })

  it('threadPatch proyecta la sesión del thread activo', () => {
    expect(threadPatch(selectThread(base, 'b')).cliSessionId).toBe('sess-b')
    expect(threadPatch(selectThread(base, 'a')).cliSessionId).toBeUndefined()
  })

  it('sortThreadsByRecency ordena de más nuevo a más viejo', () => {
    expect(sortThreadsByRecency(base.threads).map(thread => thread.id)).toEqual(['b', 'a'])
  })

  it('stripThreadSessions deja el historial y quita la sesión CLI', () => {
    const stripped = stripThreadSessions(base.threads)
    expect(stripped.map(thread => thread.title)).toEqual(['vieja', 'nueva'])
    expect(stripped.every(thread => thread.cliSessionId === undefined)).toBe(true)
  })
})

describe('resolvePreferredHumanThreadId', () => {
  it('elige el humano más reciente e ignora delegaciones', () => {
    const state = sanitizeThreadState(
      [
        { id: 't1', title: 'main', updatedAt: 100, origin: 'human' },
        { id: 't2', title: 'newer', updatedAt: 300, origin: 'human' },
        { id: 'd1', title: 'del', updatedAt: 999, origin: 'delegation' },
      ],
      't1',
    )
    expect(resolvePreferredHumanThreadId(state)).toBe('t2')
  })

  it('trata hilos legacy sin origin como humanos', () => {
    const state = sanitizeThreadState(
      [
        { id: 't1', title: 'old', updatedAt: 10 },
        { id: 't3', title: 'recent', updatedAt: 50 },
      ],
      't1',
    )
    expect(resolvePreferredHumanThreadId(state)).toBe('t3')
  })
})

describe('resolveCardOpenThreadId', () => {
  it('con un solo hilo en curso de delegación abre el humano preferido', () => {
    const state = sanitizeThreadState(
      [
        { id: 'h1', title: 'main', updatedAt: 500, origin: 'human' },
        { id: 'd1', title: 'del', updatedAt: 50, origin: 'delegation' },
      ],
      'h1',
    )
    expect(resolveCardOpenThreadId(state, ['d1'])).toBe('h1')
  })

  it('con un humano en curso abre ese hilo', () => {
    const state = sanitizeThreadState(
      [
        { id: 'h1', title: 'main', updatedAt: 100, origin: 'human' },
        { id: 'h2', title: 'newer', updatedAt: 300, origin: 'human' },
        { id: 'd1', title: 'del', updatedAt: 50, origin: 'delegation' },
      ],
      'h1',
    )
    expect(resolveCardOpenThreadId(state, ['h2', 'd1'])).toBe('h2')
  })

  it('con varios humanos en curso usa el humano más reciente entre los que corren', () => {
    const state = sanitizeThreadState(
      [
        { id: 'h1', title: 'main', updatedAt: 100, origin: 'human' },
        { id: 'h2', title: 'newer', updatedAt: 300, origin: 'human' },
        { id: 'd1', title: 'del', updatedAt: 50, origin: 'delegation' },
        { id: 'd2', title: 'del2', updatedAt: 60, origin: 'delegation' },
      ],
      'h1',
    )
    expect(resolveCardOpenThreadId(state, ['h1', 'd1', 'd2'])).toBe('h1')
    expect(resolveCardOpenThreadId(state, ['h1', 'h2', 'd1', 'd2'])).toBe('h2')
  })

  it('sin hilos humanos en curso usa el humano preferido', () => {
    const state = sanitizeThreadState(
      [
        { id: 'h1', title: 'main', updatedAt: 100, origin: 'human' },
        { id: 'h2', title: 'newer', updatedAt: 300, origin: 'human' },
      ],
      'h1',
    )
    expect(resolveCardOpenThreadId(state, [])).toBe('h2')
  })
})

describe('selectThreadOpened', () => {
  it('actualiza updatedAt aunque el hilo ya esté activo', () => {
    const state = sanitizeThreadState(
      [{ id: 't1', title: 'main', updatedAt: 10, origin: 'human' }],
      't1',
    )
    const next = selectThreadOpened(state, 't1', 500)
    expect(next.activeThreadId).toBe('t1')
    expect(next.threads[0]!.updatedAt).toBe(500)
  })

  it('cambia activo y marca apertura', () => {
    const state = sanitizeThreadState(
      [
        { id: 't1', title: 'a', updatedAt: 10, origin: 'human' },
        { id: 't2', title: 'b', updatedAt: 20, origin: 'human' },
      ],
      't1',
    )
    const next = selectThreadOpened(state, 't2', 400)
    expect(next.activeThreadId).toBe('t2')
    expect(next.threads.find(thread => thread.id === 't2')!.updatedAt).toBe(400)
  })
})

describe('pruneCompletedDelegationThreads', () => {
  it('borra solo hilos de delegación y conserva los humanos', () => {
    const state = sanitizeThreadState(
      [
        { id: 'h1', title: 'main', updatedAt: 100, origin: 'human' },
        { id: 'd1', title: 'del', updatedAt: 50, origin: 'delegation', delegationId: 'del-1' },
      ],
      'h1',
    )
    const { state: next, deletedIds } = pruneCompletedDelegationThreads(state, ['d1'], 'fb', 200)
    expect(deletedIds).toEqual(['d1'])
    expect(next.threads.map(thread => thread.id)).toEqual(['h1'])
    expect(next.activeThreadId).toBe('h1')
  })

  it('si el activo era delegación, salta al humano más reciente', () => {
    const state = sanitizeThreadState(
      [
        { id: 'h1', title: 'main', updatedAt: 100, origin: 'human' },
        { id: 'h2', title: 'older', updatedAt: 80, origin: 'human' },
        { id: 'd1', title: 'del', updatedAt: 50, origin: 'delegation' },
      ],
      'd1',
    )
    const { state: next } = pruneCompletedDelegationThreads(state, ['d1'], 'fb', 200)
    expect(next.activeThreadId).toBe('h1')
    expect(next.threads.some(thread => thread.id === 'd1')).toBe(false)
    expect(next.threads.length).toBeGreaterThan(0)
  })

  it('no borra hilos humanos ni sin origin delegation', () => {
    const state = sanitizeThreadState(
      [{ id: 'h1', title: 'main', updatedAt: 100, origin: 'human' }],
      'h1',
    )
    const { state: next, deletedIds } = pruneCompletedDelegationThreads(state, ['h1'], 'fb', 200)
    expect(deletedIds).toEqual([])
    expect(next).toBe(state)
  })
})

describe('thread history helpers', () => {
  const threads = [
    { id: 't1', title: 'One', updatedAt: 6 },
    { id: 't2', title: 'Two', updatedAt: 5 },
    { id: 't3', title: 'Three', updatedAt: 4 },
    { id: 't4', title: 'Four', updatedAt: 3 },
    { id: 't5', title: 'Five', updatedAt: 2 },
    { id: 't6', title: 'Six', updatedAt: 1 },
  ]

  it('chipVisibleThreadIds incluye activo y hasta 5 recientes', () => {
    const ids = chipVisibleThreadIds(threads, 't1', ['t2', 't3'])
    expect([...ids].sort()).toEqual(['t1', 't2', 't3', 't4', 't5', 't6'])
  })

  it('recentChipThreads devuelve hasta MAX_RECENT_CHIP_THREADS sin el activo', () => {
    const recent = recentChipThreads(threads, 't1', ['t2'])
    expect(recent.map(thread => thread.id)).toEqual(['t2', 't3', 't4', 't5', 't6'].slice(0, MAX_RECENT_CHIP_THREADS))
    expect(recent).toHaveLength(MAX_RECENT_CHIP_THREADS)
  })

  it('barChipThreads pone el activo a la izquierda; el resto por recencia', () => {
    const chips = barChipThreads(threads, 't3', ['t2'])
    expect(chips.map(thread => thread.id)).toEqual(['t3', 't1', 't2', 't4', 't5', 't6'])
  })

  it('barChipThreads pone el activo primero aunque no sea el más reciente', () => {
    const chips = barChipThreads(threads, 't6', [])
    expect(chips.map(thread => thread.id)[0]).toBe('t6')
    expect(chips.map(thread => thread.id).slice(1)).toEqual(['t1', 't2', 't3', 't4', 't5'])
  })

  it('threadHistoryCandidates excluye activo y chips recientes', () => {
    const sevenThreads = [
      ...threads,
      { id: 't7', title: 'Seven', updatedAt: 0 },
    ]
    const candidates = threadHistoryCandidates(sevenThreads, 't1', ['t2'])
    expect(candidates.map(thread => thread.id)).toEqual(['t7'])
  })

  it('threadBarCandidates deja fuera los carriles de delegación cerrados', () => {
    const withLanes = [
      ...threads,
      { id: 'd1', title: '', updatedAt: 900, origin: 'delegation' as const },
      { id: 'd2', title: '', updatedAt: 901, origin: 'delegation' as const },
    ]
    // d2 sigue corriendo: se muestra. d1 ya terminó: no ensucia el historial.
    const candidates = threadBarCandidates(withLanes, 't1', ['d2'])
    expect(candidates.map(thread => thread.id)).toContain('d2')
    expect(candidates.map(thread => thread.id)).not.toContain('d1')
  })

  it('paginateThreadHistory devuelve items y hasMore', () => {
    const manyThreads = [
      ...threads,
      { id: 't7', title: 'Seven', updatedAt: 0 },
      { id: 't8', title: 'Eight', updatedAt: -1 },
      { id: 't9', title: 'Nine', updatedAt: -2 },
      { id: 't10', title: 'Ten', updatedAt: -3 },
      { id: 't11', title: 'Eleven', updatedAt: -4 },
      { id: 't12', title: 'Twelve', updatedAt: -5 },
    ]
    const candidates = threadHistoryCandidates(manyThreads, 't1', ['t2'])
    expect(candidates.map(thread => thread.id)).toEqual(['t7', 't8', 't9', 't10', 't11', 't12'])
    expect(paginateThreadHistory(candidates, 5)).toEqual({
      items: candidates.slice(0, 5),
      hasMore: true,
    })
    expect(paginateThreadHistory(candidates, 2)).toEqual({
      items: candidates.slice(0, 2),
      hasMore: true,
    })
  })

  it('splitThreadHistoryCandidates pone delegaciones antes que humanos y omite chips recientes', () => {
    const withLanes = [
      ...threads,
      { id: 't7', title: 'Seven', updatedAt: 0 },
      { id: 'd2', title: '', updatedAt: 901, origin: 'delegation' as const },
    ]
    const { delegations, humans } = splitThreadHistoryCandidates(withLanes, 't1', ['d2', 't2'])
    expect(delegations.map(thread => thread.id)).toEqual([])
    expect(humans.map(thread => thread.id)).toEqual(['t6', 't7'])
  })
})

describe('delegationThreadIdsForDelegationIds', () => {
  const state = sanitizeThreadState(
    [
      { id: 'human-1', title: 'main', updatedAt: 100, origin: 'human', delegationId: 'd-1' },
      { id: 'del-1', title: '', updatedAt: 50, origin: 'delegation', delegationId: 'd-1' },
      { id: 'del-2', title: '', updatedAt: 60, origin: 'delegation', delegationId: 'd-2' },
      { id: 'del-3', title: '', updatedAt: 70, origin: 'delegation' },
    ],
    'human-1',
  )

  it('incluye hilos delegation cuyo delegationId coincide', () => {
    expect(delegationThreadIdsForDelegationIds(state, ['d-1'])).toEqual(['del-1'])
  })

  it('excluye hilos humanos aunque compartan delegationId', () => {
    expect(delegationThreadIdsForDelegationIds(state, ['d-1', 'd-2'])).toEqual(['del-1', 'del-2'])
    expect(delegationThreadIdsForDelegationIds(state, ['d-1'])).not.toContain('human-1')
  })

  it('excluye hilos delegation sin delegationId', () => {
    expect(delegationThreadIdsForDelegationIds(state, ['d-1', 'd-2'])).not.toContain('del-3')
  })

  it('no duplica ids de entrada repetidos', () => {
    expect(delegationThreadIdsForDelegationIds(state, ['d-1', ' d-1 ', ''])).toEqual(['del-1'])
  })
})
