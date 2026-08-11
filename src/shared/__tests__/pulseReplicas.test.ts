import { describe, expect, it } from 'vitest'
import type { PulseAgentStat } from '../pulseEvents'
import { foldPulseReplicas } from '../pulseReplicas'

function stat(over: Partial<PulseAgentStat> & { agentId: string }): PulseAgentStat {
  return {
    name: undefined,
    provider: undefined,
    turns: 0,
    commits: 0,
    delegationsOut: 0,
    delegationsIn: 0,
    results: 0,
    loopTurns: 0,
    tokens: 0,
    activeDays: 0,
    avgDurationMs: 0,
    lastTs: 0,
    modes: { ask: 0, plan: 0, auto: 0, other: 0 },
    series: [0, 0, 0],
    repos: [],
    ...over,
  }
}

describe('foldPulseReplicas', () => {
  it('folds base-n under its base and sums the numbers', () => {
    const groups = foldPulseReplicas([
      stat({ agentId: 'backend', name: 'Cristian', provider: 'cursor', turns: 1, tokens: 265_811, series: [0, 0, 1] }),
      stat({ agentId: 'backend-2', name: 'Cristian (replica)', turns: 1, tokens: 0, series: [0, 0, 1] }),
      stat({ agentId: 'backend-3', name: 'Cristian (replica)', turns: 1, tokens: 0, series: [0, 0, 1] }),
    ])

    expect(groups).toHaveLength(1)
    expect(groups[0].base.agentId).toBe('backend')
    expect(groups[0].base.turns).toBe(3)
    expect(groups[0].base.tokens).toBe(265_811)
    // El nombre es el del catálogo, no el " (replica)" de la copia.
    expect(groups[0].base.name).toBe('Cristian')
    expect(groups[0].base.provider).toBe('cursor')
    expect(groups[0].instances.map(i => i.agentId)).toEqual(['backend', 'backend-2', 'backend-3'])
  })

  it('leaves a lone agent untouched, same object', () => {
    const solo = stat({ agentId: 'product-owner', turns: 3 })
    const groups = foldPulseReplicas([solo])
    expect(groups).toHaveLength(1)
    expect(groups[0].base).toBe(solo)
    expect(groups[0].peakSameDay).toBe(1)
    expect(groups[0].emptyReplicas).toBe(0)
  })

  it('does NOT fold when the base is absent from the roster', () => {
    const groups = foldPulseReplicas([
      stat({ agentId: 'sprint-2', turns: 4 }),
      stat({ agentId: 'qa', turns: 1 }),
    ])
    expect(groups.map(g => g.base.agentId)).toEqual(['sprint-2', 'qa'])
  })

  it('ignores non-numeric suffixes', () => {
    const groups = foldPulseReplicas([
      stat({ agentId: 'product', turns: 1 }),
      stat({ agentId: 'product-owner', turns: 1 }),
    ])
    expect(groups.map(g => g.base.agentId)).toEqual(['product', 'product-owner'])
  })

  it('reads the peak from instances active on the same day', () => {
    const sameDay = foldPulseReplicas([
      stat({ agentId: 'be', series: [0, 1, 0] }),
      stat({ agentId: 'be-2', series: [0, 1, 0] }),
      stat({ agentId: 'be-3', series: [0, 1, 0] }),
    ])
    expect(sameDay[0].peakSameDay).toBe(3)

    const staggered = foldPulseReplicas([
      stat({ agentId: 'be', series: [1, 0, 0] }),
      stat({ agentId: 'be-2', series: [0, 1, 0] }),
    ])
    expect(staggered[0].peakSameDay).toBe(1)
  })

  it('counts replicas that burned a turn for zero tokens', () => {
    const groups = foldPulseReplicas([
      stat({ agentId: 'be', turns: 1, tokens: 500 }),
      stat({ agentId: 'be-2', turns: 1, tokens: 0 }),
      stat({ agentId: 'be-3', turns: 1, tokens: 900 }),
      stat({ agentId: 'be-4', turns: 0, tokens: 0 }),
    ])
    // be-4 nunca corrió: no es desperdicio, es una fila sin actividad.
    expect(groups[0].emptyReplicas).toBe(1)
  })

  it('counts a shared day once in activeDays instead of doubling it', () => {
    const groups = foldPulseReplicas([
      stat({ agentId: 'be', turns: 1, activeDays: 1, series: [0, 1, 0] }),
      stat({ agentId: 'be-2', turns: 1, activeDays: 1, series: [0, 1, 0] }),
    ])
    expect(groups[0].base.activeDays).toBe(1)
    expect(groups[0].base.series).toEqual([0, 2, 0])
  })

  it('keeps the newest lastTs and merges repos by turns', () => {
    const groups = foldPulseReplicas([
      stat({ agentId: 'be', lastTs: 10, repos: [{ repo: 'app', turns: 1 }] }),
      stat({ agentId: 'be-2', lastTs: 99, repos: [{ repo: 'api', turns: 5 }, { repo: 'app', turns: 2 }] }),
    ])
    expect(groups[0].base.lastTs).toBe(99)
    expect(groups[0].base.repos).toEqual([
      { repo: 'api', turns: 5 },
      { repo: 'app', turns: 3 },
    ])
  })

  it('averages duration weighted by turns, not by instance', () => {
    const groups = foldPulseReplicas([
      stat({ agentId: 'be', turns: 9, avgDurationMs: 1000 }),
      stat({ agentId: 'be-2', turns: 1, avgDurationMs: 11_000 }),
    ])
    expect(groups[0].base.avgDurationMs).toBe(2000)
  })

  it('preserves the incoming order of the base rows', () => {
    const groups = foldPulseReplicas([
      stat({ agentId: 'qa', turns: 400 }),
      stat({ agentId: 'be', turns: 1 }),
      stat({ agentId: 'be-2', turns: 1 }),
      stat({ agentId: 'fe', turns: 2 }),
    ])
    expect(groups.map(g => g.base.agentId)).toEqual(['qa', 'be', 'fe'])
  })
})
