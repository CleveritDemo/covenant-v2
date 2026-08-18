import { join, resolve } from 'path'
import { describe, expect, it } from 'vitest'
import { partitionProjectFilePaths, relativeProjectFilePaths } from '../contextFilePick'

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

describe('partitionProjectFilePaths', () => {
  const root = join('/tmp', 'proj')

  it('todo dentro → inside con rel en /, outside vacío', () => {
    const a = join(root, 'src', 'foo.ts')
    const b = join(root, 'bar.ts')
    expect(partitionProjectFilePaths(root, [a, b])).toEqual({
      inside: [
        { abs: resolve(a), rel: 'src/foo.ts' },
        { abs: resolve(b), rel: 'bar.ts' },
      ],
      outside: [],
    })
  })

  it('todo fuera → outside con abs resuelto, inside vacío', () => {
    const a = join('/tmp', 'other', 'secret.ts')
    const b = join('/tmp', 'else', 'x.pdf')
    expect(partitionProjectFilePaths(root, [a, b])).toEqual({
      inside: [],
      outside: [resolve(a), resolve(b)],
    })
  })

  it('mezclado conserva el orden de cada lado', () => {
    const insideA = join(root, 'a.ts')
    const outsideA = join('/tmp', 'other', 'x.pdf')
    const insideB = join(root, 'b.ts')
    expect(partitionProjectFilePaths(root, [insideA, outsideA, insideB])).toEqual({
      inside: [
        { abs: resolve(insideA), rel: 'a.ts' },
        { abs: resolve(insideB), rel: 'b.ts' },
      ],
      outside: [resolve(outsideA)],
    })
  })

  it('dedupe: inside por rel, outside por abs resuelto, conservando orden', () => {
    const a = join(root, 'a.ts')
    const b = join(root, 'b.ts')
    const out = join('/tmp', 'other', 'x.pdf')
    const outAlias = join('/tmp', 'other', '.', 'x.pdf')
    expect(partitionProjectFilePaths(root, [a, out, b, a, outAlias])).toEqual({
      inside: [
        { abs: resolve(a), rel: 'a.ts' },
        { abs: resolve(b), rel: 'b.ts' },
      ],
      outside: [resolve(out)],
    })
  })

  it('el propio root cuenta como fuera', () => {
    expect(partitionProjectFilePaths(root, [root])).toEqual({
      inside: [],
      outside: [resolve(root)],
    })
  })

  it('normaliza barras de Windows en el rel de inside', () => {
    const abs = join(root, 'src\\foo.ts')
    expect(partitionProjectFilePaths(root, [abs])).toEqual({
      inside: [{ abs: resolve(abs), rel: 'src/foo.ts' }],
      outside: [],
    })
  })
})
