import { resolve } from 'path'
import { describe, expect, it } from 'vitest'
import { resolveContextRoot } from '../contextRootResolve'

describe('resolveContextRoot', () => {
  const cwd = '/workspace'

  it('(a) rootPath vacío → resolve(cwd)', () => {
    const result = resolveContextRoot({
      cwd,
      rootPath: '',
      exists: () => false,
      listDirs: () => [],
    })
    expect(result).toEqual({ ok: true, root: resolve(cwd) })
  })

  it("(b) rootPath '.' → resolve(cwd)", () => {
    const result = resolveContextRoot({
      cwd,
      rootPath: '.',
      exists: () => false,
      listDirs: () => [],
    })
    expect(result).toEqual({ ok: true, root: resolve(cwd) })
  })

  it('(c) ruta exacta que existe', () => {
    const exists = (abs: string) => abs === resolve(cwd, 'src')
    const result = resolveContextRoot({
      cwd,
      rootPath: 'src',
      exists,
      listDirs: () => ['repo-a'],
    })
    expect(result).toEqual({ ok: true, root: resolve(cwd, 'src') })
  })

  it('(d) no existe arriba pero sí bajo una única subcarpeta', () => {
    const exists = (abs: string) => abs === resolve(cwd, 'repo-a', 'src')
    const result = resolveContextRoot({
      cwd,
      rootPath: 'src',
      exists,
      listDirs: () => ['repo-a', 'repo-b'],
    })
    expect(result).toEqual({
      ok: true,
      root: resolve(cwd, 'repo-a', 'src'),
      rebasedUnder: 'repo-a',
    })
  })

  it('(e) misma ruta bajo dos subcarpetas → ambiguous', () => {
    const exists = (abs: string) =>
      abs === resolve(cwd, 'repo-a', 'src')
      || abs === resolve(cwd, 'repo-b', 'src')
    const result = resolveContextRoot({
      cwd,
      rootPath: 'src',
      exists,
      listDirs: () => ['repo-b', 'repo-a'],
    })
    expect(result).toEqual({ ok: false, reason: 'ambiguous' })
  })

  it('(f) ruta que no existe en ningún lado → not-found', () => {
    const result = resolveContextRoot({
      cwd,
      rootPath: 'missing',
      exists: () => false,
      listDirs: () => ['repo-a'],
    })
    expect(result).toEqual({ ok: false, reason: 'not-found' })
  })

  it("(g) '../fuera' sin match en subcarpetas → not-found (no cwd)", () => {
    const result = resolveContextRoot({
      cwd,
      rootPath: '../fuera',
      exists: () => false,
      listDirs: () => ['repo-a'],
    })
    expect(result).toEqual({ ok: false, reason: 'not-found' })
    expect(result).not.toEqual({ ok: true, root: resolve(cwd) })
  })

  it("(h) ruta anidada 'apps/web' bajo una subcarpeta", () => {
    const exists = (abs: string) => abs === resolve(cwd, 'monorepo', 'apps', 'web')
    const result = resolveContextRoot({
      cwd,
      rootPath: 'apps/web',
      exists,
      listDirs: () => ['monorepo'],
    })
    expect(result).toEqual({
      ok: true,
      root: resolve(cwd, 'monorepo', 'apps', 'web'),
      rebasedUnder: 'monorepo',
    })
  })
})
