import { join } from 'path'
import { describe, expect, it } from 'vitest'
import { relativeProjectFilePaths } from '../contextFilePick'

describe('relativeProjectFilePaths', () => {
  const root = join('/tmp', 'proj')

  it('ruta dentro del root → relativa con /', () => {
    const result = relativeProjectFilePaths(root, [join(root, 'src', 'foo.ts')])
    expect(result).toEqual({ ok: true, paths: ['src/foo.ts'] })
  })

  it("ruta fuera → error 'outside project folder'", () => {
    const result = relativeProjectFilePaths(root, [join('/tmp', 'other', 'secret.ts')])
    expect(result).toEqual({ ok: false, error: 'outside project folder' })
  })

  it('duplicados colapsados conservando orden', () => {
    const a = join(root, 'a.ts')
    const b = join(root, 'b.ts')
    const result = relativeProjectFilePaths(root, [a, b, a])
    expect(result).toEqual({ ok: true, paths: ['a.ts', 'b.ts'] })
  })

  it('el propio root → error', () => {
    const result = relativeProjectFilePaths(root, [root])
    expect(result).toEqual({ ok: false, error: 'outside project folder' })
  })
})
