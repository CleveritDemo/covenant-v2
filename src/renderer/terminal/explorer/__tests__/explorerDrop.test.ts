import { describe, expect, it } from 'vitest'
import {
  dragExceedsThreshold,
  resolveExplorerMovePaths,
} from '../explorerPathUtils'

describe('resolveExplorerMovePaths', () => {
  it('dest igual al padre actual es no-op silencioso', () => {
    const result = resolveExplorerMovePaths(['src/foo.ts'], 'src')
    expect(result.movePaths).toEqual([])
    expect(result.intoSelf).toBe(false)
  })

  it('src igual a dest deja movePaths vacío', () => {
    const result = resolveExplorerMovePaths(['src'], 'src')
    expect(result.movePaths).toEqual([])
  })

  it('carpeta dentro de sí misma marca intoSelf', () => {
    const result = resolveExplorerMovePaths(['src'], 'src/nested')
    expect(result.movePaths).toEqual([])
    expect(result.intoSelf).toBe(true)
  })

  it('move legítimo a otra carpeta deja un path', () => {
    const result = resolveExplorerMovePaths(['src/foo.ts'], 'lib')
    expect(result.movePaths).toEqual(['src/foo.ts'])
    expect(result.intoSelf).toBe(false)
  })

  it('multi-selección mixta: no-op del padre, intoSelf y move real', () => {
    const result = resolveExplorerMovePaths(
      ['src/nested/foo.ts', 'src', 'lib/c.ts', 'src/nested', ''],
      'src/nested',
    )
    expect(result.movePaths).toEqual(['lib/c.ts'])
    expect(result.intoSelf).toBe(true)
  })
})

describe('dragExceedsThreshold', () => {
  it('3px no supera el umbral', () => {
    expect(dragExceedsThreshold(0, 0, 3, 0)).toBe(false)
  })

  it('40px sí supera el umbral', () => {
    expect(dragExceedsThreshold(0, 0, 40, 0)).toBe(true)
  })

  it('NaN no bloquea el arrastre', () => {
    expect(dragExceedsThreshold(NaN, 0, 3, 0)).toBe(true)
  })
})
