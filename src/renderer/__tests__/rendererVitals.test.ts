import { describe, expect, it } from 'vitest'
import type { TabSession } from '@shared/tabSession'
import { collectRendererVitalsStats } from '../rendererVitals'

function tab(id: string, paneIds: string[], agentPanes: string[] = []): TabSession {
  return {
    id,
    paneIds,
    agentByPane: Object.fromEntries(
      agentPanes.map(paneId => [paneId, { agentId: 'a', threads: [], activeThreadId: 't1' }]),
    ),
  } as unknown as TabSession
}

describe('collectRendererVitalsStats', () => {
  it('suma panes y panes de agente de todos los tabs', () => {
    const stats = collectRendererVitalsStats(
      [tab('t1', ['p1', 'p2'], ['p1']), tab('t2', ['p3'], ['p3'])],
      new Set(['p1']),
      {},
    )
    expect(stats).toEqual({
      tabs: 2,
      panes: 3,
      agentPanes: 2,
      busyPanes: 1,
      runningLanes: 0,
    })
  })

  it('suma los carriles vivos de todos los panes', () => {
    const stats = collectRendererVitalsStats([], new Set(), {
      p1: { runningThreadIds: ['t1', 't2'] },
      p2: { runningThreadIds: ['t3'] },
    })
    expect(stats.runningLanes).toBe(3)
  })

  it('tolera tabs sin paneIds ni agentByPane', () => {
    const stats = collectRendererVitalsStats(
      [{ id: 't1' } as unknown as TabSession],
      new Set(),
      { p1: {} },
    )
    expect(stats).toEqual({
      tabs: 1,
      panes: 0,
      agentPanes: 0,
      busyPanes: 0,
      runningLanes: 0,
    })
  })

  it('devuelve ceros sin tabs ni estado', () => {
    expect(collectRendererVitalsStats([], new Set(), {})).toEqual({
      tabs: 0,
      panes: 0,
      agentPanes: 0,
      busyPanes: 0,
      runningLanes: 0,
    })
  })
})
