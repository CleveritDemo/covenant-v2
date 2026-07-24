import { describe, expect, it } from 'vitest'
import {
  contextIdsEqual,
  resolveAssignedContextChips,
} from '../resolveAssignedContextChips'

describe('resolveAssignedContextChips', () => {
  it('keeps discovered contexts and synthesizes missing agentResult ids', () => {
    const chips = resolveAssignedContextChips(
      ['iaterminal:folderTree', 'iaterminal:result:fullstack', 'iaterminal:notes:x'],
      [{
        id: 'iaterminal:folderTree',
        name: 'Folders',
        fileName: 'folders.md',
        kind: 'folderTree',
      }],
      new Map([['iaterminal:result:fullstack', 2]]),
      kind => kind,
    )
    expect(chips).toHaveLength(2)
    expect(chips[0]).toMatchObject({
      id: 'iaterminal:folderTree',
      name: 'Folders',
      kind: 'folderTree',
      shared: false,
    })
    expect(chips[1]).toMatchObject({
      id: 'iaterminal:result:fullstack',
      name: 'fullstack',
      kind: 'agentResult',
      shared: true,
    })
  })

  it('compares context id lists', () => {
    expect(contextIdsEqual(undefined, undefined)).toBe(true)
    expect(contextIdsEqual(['a'], ['a'])).toBe(true)
    expect(contextIdsEqual(['a'], ['b'])).toBe(false)
  })
})
