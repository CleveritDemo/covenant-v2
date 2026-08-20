import { describe, expect, it } from 'vitest'
import { ALL_CONTEXT_KINDS } from '../tabContext'
import { buildContextTransferTargets, canTransferContextKind } from '../contextTransfer'

describe('buildContextTransferTargets', () => {
  it('descarta pestañas sin carpeta de proyecto', () => {
    const tabs = [
      { id: 'a', title: 'Sin carpeta' },
      { id: 'b', title: 'Vacía', projectFolder: '   ' },
      { id: 'c', title: 'Ok', projectFolder: '/tmp/ws-a' },
    ]
    expect(buildContextTransferTargets(tabs, '/tmp/current')).toEqual([
      { tabId: 'c', title: 'Ok', cwd: '/tmp/ws-a' },
    ])
  })

  it('excluye la carpeta del workspace actual', () => {
    const tabs = [
      { id: 'a', title: 'Actual', projectFolder: '/tmp/current' },
      { id: 'b', title: 'Otro', projectFolder: '/tmp/other' },
    ]
    expect(buildContextTransferTargets(tabs, '  /tmp/current  ')).toEqual([
      { tabId: 'b', title: 'Otro', cwd: '/tmp/other' },
    ])
  })

  it('deduplica por cwd conservando la primera pestaña', () => {
    const tabs = [
      { id: 'first', title: 'Primera', projectFolder: '/tmp/shared' },
      { id: 'second', title: 'Segunda', projectFolder: '/tmp/shared' },
      { id: 'third', title: 'Tercera', projectFolder: '  /tmp/shared  ' },
    ]
    expect(buildContextTransferTargets(tabs, '/tmp/current')).toEqual([
      { tabId: 'first', title: 'Primera', cwd: '/tmp/shared' },
    ])
  })

  it('preserva el orden de entrada', () => {
    const tabs = [
      { id: '1', title: 'Alpha', projectFolder: '/tmp/a' },
      { id: '2', title: 'Beta', projectFolder: '/tmp/b' },
      { id: '3', title: 'Gamma', projectFolder: '/tmp/c' },
    ]
    expect(buildContextTransferTargets(tabs, '')).toEqual([
      { tabId: '1', title: 'Alpha', cwd: '/tmp/a' },
      { tabId: '2', title: 'Beta', cwd: '/tmp/b' },
      { tabId: '3', title: 'Gamma', cwd: '/tmp/c' },
    ])
  })
})

describe('canTransferContextKind', () => {
  it('solo agentResult devuelve false en ALL_CONTEXT_KINDS', () => {
    for (const kind of ALL_CONTEXT_KINDS) {
      expect(canTransferContextKind(kind)).toBe(kind !== 'agentResult')
    }
    expect(ALL_CONTEXT_KINDS.filter((k) => !canTransferContextKind(k))).toEqual(['agentResult'])
  })
})
