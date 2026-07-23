import { describe, expect, it } from 'vitest'
import {
  computeTabInsertIndex,
  dropPlaceFromPointer,
  insertIndexFromPointerY,
  moveItemToIndex,
  reorderPaneIdsByKind,
  swapItemsAtIndices,
} from '../arrayReorder'

describe('moveItemToIndex', () => {
  it('moves forward in the list', () => {
    expect(moveItemToIndex(['a', 'b', 'c', 'd'], 0, 2)).toEqual(['b', 'c', 'a', 'd'])
  })

  it('moves backward in the list', () => {
    expect(moveItemToIndex(['a', 'b', 'c', 'd'], 3, 1)).toEqual(['a', 'd', 'b', 'c'])
  })
})

describe('swapItemsAtIndices', () => {
  it('swaps two pane slots without shifting others', () => {
    expect(swapItemsAtIndices(['a', 'b', 'c', 'd'], 0, 3)).toEqual(['d', 'b', 'c', 'a'])
    expect(swapItemsAtIndices(['a', 'b', 'c', 'd'], 1, 2)).toEqual(['a', 'c', 'b', 'd'])
  })
})

describe('computeTabInsertIndex', () => {
  const ids = ['t1', 't2', 't3', 't4']

  function reorder(dragId: string, dropId: string, place: 'before' | 'after'): string[] {
    const fromIdx = ids.indexOf(dragId)
    const dropIdx = ids.indexOf(dropId)
    const insertAt = computeTabInsertIndex(ids.length, fromIdx, dropIdx, place)
    return moveItemToIndex(ids, fromIdx, insertAt)
  }

  it('inserts before the drop target', () => {
    expect(reorder('t4', 't2', 'before')).toEqual(['t1', 't4', 't2', 't3'])
  })

  it('inserts after the drop target', () => {
    expect(reorder('t4', 't2', 'after')).toEqual(['t1', 't2', 't4', 't3'])
  })

  it('moves an earlier tab after a later tab', () => {
    expect(reorder('t1', 't3', 'after')).toEqual(['t2', 't3', 't1', 't4'])
  })
})

describe('dropPlaceFromPointer', () => {
  it('chooses before/after from pointer position', () => {
    const rect = { left: 100, width: 200 }
    expect(dropPlaceFromPointer(150, rect)).toBe('before')
    expect(dropPlaceFromPointer(250, rect)).toBe('after')
  })
})

describe('reorderPaneIdsByKind', () => {
  const kinds = { t1: 'terminal', t2: 'terminal', a1: 'agent', a2: 'agent' }

  it('reorders terminals and keeps agents after', () => {
    expect(reorderPaneIdsByKind(['t1', 'a1', 't2', 'a2'], kinds, 'terminal', ['t2', 't1']))
      .toEqual(['t2', 't1', 'a1', 'a2'])
  })

  it('reorders agents and keeps terminals first', () => {
    expect(reorderPaneIdsByKind(['t1', 'a1', 't2', 'a2'], kinds, 'agent', ['a2', 'a1']))
      .toEqual(['t1', 't2', 'a2', 'a1'])
  })

  it('rejects incomplete kind lists', () => {
    expect(reorderPaneIdsByKind(['t1', 't2', 'a1'], kinds, 'terminal', ['t1']))
      .toEqual(['t1', 't2', 'a1'])
  })

  it('handles single-item kind', () => {
    expect(reorderPaneIdsByKind(['a1', 't1'], kinds, 'agent', ['a1']))
      .toEqual(['t1', 'a1'])
  })
})

describe('insertIndexFromPointerY', () => {
  const slots = {
    a: { y: 0, height: 100 },
    b: { y: 120, height: 100 },
    c: { y: 240, height: 100 },
  }

  it('inserts before the first midpoint', () => {
    expect(insertIndexFromPointerY(['a', 'b', 'c'], slots, 10, 'b')).toBe(0)
  })

  it('inserts between remaining items', () => {
    expect(insertIndexFromPointerY(['a', 'b', 'c'], slots, 200, 'a')).toBe(1)
  })

  it('inserts at the end', () => {
    expect(insertIndexFromPointerY(['a', 'b', 'c'], slots, 400, 'a')).toBe(2)
  })
})
