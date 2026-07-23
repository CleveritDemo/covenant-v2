import { describe, expect, it } from 'vitest'
import { normalizeSplitSizes, normalizeTabSession } from '../tabSplitSizes'

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
})
