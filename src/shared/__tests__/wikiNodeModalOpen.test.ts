import { describe, expect, it } from 'vitest'
import { mergeWikiNodeModalsOpen, type WikiNodeModalEntry } from '../wikiNodeModalOpen'

function entry(slug: string, x = 0, y = 0): WikiNodeModalEntry {
  return { slug, x, y }
}

describe('mergeWikiNodeModalsOpen', () => {
  it('previous [a], open [b] → [a,b]', () => {
    expect(mergeWikiNodeModalsOpen([entry('a')], [entry('b')])).toEqual([
      entry('a'),
      entry('b'),
    ])
  })

  it('previous [a,b,c], open [d] → still [a,b,c] (no eviction)', () => {
    const previous = [entry('a'), entry('b'), entry('c')]
    expect(mergeWikiNodeModalsOpen(previous, [entry('d')])).toEqual(previous)
  })

  it('previous [a], open [a] with new coords → updates a only', () => {
    expect(mergeWikiNodeModalsOpen([entry('a', 1, 2)], [entry('a', 9, 8)])).toEqual([
      entry('a', 9, 8),
    ])
  })
})
