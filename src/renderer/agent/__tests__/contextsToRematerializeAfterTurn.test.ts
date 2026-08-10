import { describe, expect, it } from 'vitest'
import { contextsToRematerializeAfterTurn } from '../contextsToRematerializeAfterTurn'
import type { TabContext } from '@shared/tabContext'

const notes: TabContext = {
  id: 'iaterminal:notes:About',
  name: 'About',
  fileName: 'About.md',
  kind: 'notes',
}
const folder: TabContext = {
  id: 'iaterminal:folder:src',
  name: 'src',
  fileName: 'src.md',
  kind: 'folderTree',
}
const results: TabContext = {
  id: 'iaterminal:result:fe',
  name: 'FE',
  fileName: 'results/fe.md',
  kind: 'agentResult',
}

describe('contextsToRematerializeAfterTurn', () => {
  it('skips notes and agentResult when orgWorkspace', () => {
    expect(contextsToRematerializeAfterTurn([notes, folder, results], {
      orgWorkspace: true,
    })).toEqual([folder])
  })

  it('keeps local notes writes; still skips agentResult', () => {
    expect(contextsToRematerializeAfterTurn([notes, folder, results], {
      orgWorkspace: false,
    })).toEqual([notes, folder])
  })
})
