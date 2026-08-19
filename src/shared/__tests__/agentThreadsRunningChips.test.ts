import { describe, expect, it } from 'vitest'
import {
  MAX_RECENT_CHIP_THREADS,
  barChipThreads,
  threadBarCandidates,
  threadHistoryCandidates,
} from '../agentThreads'

describe('threadBarCandidates running synthesis', () => {
  const human = { id: 'h1', title: 'Main', updatedAt: 100, origin: 'human' as const }

  it('barChipThreads incluye activo y sintéticos en orden de runningThreadIds', () => {
    const running = ['lane-a', 'lane-b', 'lane-c']
    const chips = barChipThreads([human], 'h1', running)
    expect(chips.map(thread => thread.id)).toEqual(['h1', 'lane-a', 'lane-b', 'lane-c'])
    expect(chips.slice(1).every(thread => thread.origin === 'delegation')).toBe(true)
  })

  it('no duplica un id running que ya está en el catálogo', () => {
    const catalog = [
      human,
      { id: 'lane-b', title: '', updatedAt: 50, origin: 'delegation' as const },
    ]
    const chips = barChipThreads(catalog, 'h1', ['lane-a', 'lane-b', 'lane-c'])
    const ids = chips.map(thread => thread.id)
    expect(ids.filter(id => id === 'lane-b')).toHaveLength(1)
    expect(ids).toEqual(['h1', 'lane-a', 'lane-c', 'lane-b'])
  })

  it('nunca sintetiza el id activo', () => {
    const running = ['h1', 'lane-a']
    const candidates = threadBarCandidates([human], 'h1', running)
    expect(candidates.map(thread => thread.id)).toEqual(['lane-a'])
    expect(barChipThreads([human], 'h1', running).map(thread => thread.id)).toEqual(['h1', 'lane-a'])
  })

  it('con 0 running el resultado es idéntico al comportamiento previo', () => {
    const threads = [
      { id: 't1', title: 'One', updatedAt: 6 },
      { id: 't2', title: 'Two', updatedAt: 5 },
      { id: 'd1', title: '', updatedAt: 900, origin: 'delegation' as const },
    ]
    const withoutRunning = threadBarCandidates(threads, 't1', []).map(thread => thread.id)
    const withoutRunningArg = threadBarCandidates(threads, 't1', undefined).map(thread => thread.id)
    expect(withoutRunning).toEqual(['t2'])
    expect(withoutRunningArg).toEqual(withoutRunning)
    expect(threadBarCandidates(threads, 't1', ['d1']).map(thread => thread.id)).toEqual(['d1', 't2'])
  })

  it('threadHistoryCandidates recibe el sobrante cuando hay más de MAX_RECENT_CHIP_THREADS', () => {
    const threads = [
      human,
      { id: 't2', title: 'Two', updatedAt: 90, origin: 'human' as const },
      { id: 't3', title: 'Three', updatedAt: 80, origin: 'human' as const },
      { id: 't4', title: 'Four', updatedAt: 70, origin: 'human' as const },
      { id: 't5', title: 'Five', updatedAt: 60, origin: 'human' as const },
      { id: 't6', title: 'Six', updatedAt: 50, origin: 'human' as const },
    ]
    const running = ['lane-a', 'lane-b', 'lane-c']
    const candidates = threadBarCandidates(threads, 'h1', running)
    const history = threadHistoryCandidates(threads, 'h1', running)
    expect(candidates.length).toBeGreaterThan(MAX_RECENT_CHIP_THREADS)
    expect(history).toEqual(candidates.slice(MAX_RECENT_CHIP_THREADS))
    expect(history.length).toBeGreaterThan(0)
    expect(history.every(thread => !running.includes(thread.id))).toBe(true)
  })
})
