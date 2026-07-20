import { describe, expect, it } from 'vitest'
import { normalizeSplitSizes, normalizeTabSession, columnRatioForAgentPriority } from '../tabSplitSizes'

describe('tabSplitSizes', () => {
  it('returns undefined split sizes for single pane', () => {
    expect(normalizeSplitSizes({ paneIds: ['a'] })).toBeUndefined()
  })

  it('normalizes column ratio for two panes', () => {
    const split = normalizeSplitSizes({ paneIds: ['a', 'b'], splitSizes: { columnRatio: 0.7 } })
    expect(split?.columnRatio).toBeCloseTo(0.7, 2)
  })

  it('strips split sizes from tab with one pane', () => {
    const tab = normalizeTabSession({
      id: 't1',
      title: 'T',
      paneIds: ['a'],
      activePaneId: 'a',
      splitSizes: { columnRatio: 0.5 },
    })
    expect(tab.splitSizes).toBeUndefined()
  })

  it('favors agent pane in mixed two-pane layout', () => {
    expect(
      columnRatioForAgentPriority(['agent', 'term'], { agent: 'agent' }),
    ).toBeCloseTo(0.64, 2)
    expect(
      columnRatioForAgentPriority(['term', 'agent'], { agent: 'agent' }),
    ).toBeCloseTo(0.36, 2)
    expect(
      columnRatioForAgentPriority(['a', 'b'], { a: 'agent', b: 'agent' }),
    ).toBe(0.5)
  })
})
