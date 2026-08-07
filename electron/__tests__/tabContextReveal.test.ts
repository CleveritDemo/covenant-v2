import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, describe, expect, it } from 'vitest'
import { resolveTabContextRevealPath } from '../tabContextReveal'

describe('resolveTabContextRevealPath', () => {
  const dirs: string[] = []
  const tempCwd = (): string => {
    const dir = mkdtempSync(join(tmpdir(), 'ia-terminal-reveal-'))
    dirs.push(dir)
    return dir
  }
  afterEach(() => dirs.splice(0).forEach(dir => rmSync(dir, { recursive: true, force: true })))

  it('resuelve un .md existente dentro de .gravity', () => {
    const cwd = tempCwd()
    mkdirSync(join(cwd, '.gravity'), { recursive: true })
    writeFileSync(join(cwd, '.gravity', 'context.md'), '# hola')
    // realpathSync.native normaliza symlinks del propio sistema (p. ej.
    // /tmp -> /private/tmp en macOS), así que la ruta esperada pasa por el
    // mismo canónico que usa la función bajo prueba.
    expect(resolveTabContextRevealPath(cwd, 'context.md')).toEqual({
      ok: true,
      absPath: realpathSync.native(join(cwd, '.gravity', 'context.md')),
    })
  })

  it('rechaza cwd vacío', () => {
    expect(resolveTabContextRevealPath('', 'context.md')).toEqual({ ok: false, error: 'cwd vacío' })
  })

  it('rechaza fileName vacío', () => {
    const cwd = tempCwd()
    expect(resolveTabContextRevealPath(cwd, '')).toEqual({ ok: false, error: 'archivo vacío' })
  })

  it('rechaza un archivo que todavía no se ha guardado en disco', () => {
    const cwd = tempCwd()
    mkdirSync(join(cwd, '.gravity'), { recursive: true })
    expect(resolveTabContextRevealPath(cwd, 'nuevo.md')).toEqual({
      ok: false,
      error: 'el archivo no existe todavía',
    })
  })

  it('rechaza un salto relativo tipo ../../../etc/hosts', () => {
    const cwd = tempCwd()
    mkdirSync(join(cwd, '.gravity'), { recursive: true })
    expect(resolveTabContextRevealPath(cwd, '../../../etc/hosts')).toEqual({
      ok: false,
      error: 'ruta fuera del proyecto',
    })
  })

  it('rechaza una ruta absoluta', () => {
    const cwd = tempCwd()
    mkdirSync(join(cwd, '.gravity'), { recursive: true })
    expect(resolveTabContextRevealPath(cwd, '/etc/hosts')).toEqual({
      ok: false,
      error: 'ruta fuera del proyecto',
    })
  })

  it('rechaza separadores de Windows usados para escapar', () => {
    const cwd = tempCwd()
    mkdirSync(join(cwd, '.gravity'), { recursive: true })
    expect(resolveTabContextRevealPath(cwd, '..\\..\\..\\etc\\hosts')).toEqual({
      ok: false,
      error: 'ruta fuera del proyecto',
    })
  })

  it('rechaza una ruta absoluta de Windows con letra de unidad', () => {
    const cwd = tempCwd()
    mkdirSync(join(cwd, '.gravity'), { recursive: true })
    expect(resolveTabContextRevealPath(cwd, 'C:\\Windows\\System32\\config\\SAM')).toEqual({
      ok: false,
      error: 'ruta fuera del proyecto',
    })
  })

  it('rechaza un symlink dentro de .gravity cuyo archivo real está fuera del proyecto', () => {
    const cwd = tempCwd()
    const outside = tempCwd()
    mkdirSync(join(cwd, '.gravity'), { recursive: true })
    writeFileSync(join(outside, 'secret.md'), 'fuera del proyecto')
    symlinkSync(join(outside, 'secret.md'), join(cwd, '.gravity', 'escape.md'))
    expect(resolveTabContextRevealPath(cwd, 'escape.md')).toEqual({
      ok: false,
      error: 'ruta fuera del proyecto',
    })
  })

  it('rechaza un directorio symlink dentro de .gravity que apunta fuera del proyecto', () => {
    const cwd = tempCwd()
    const outside = tempCwd()
    mkdirSync(join(cwd, '.gravity'), { recursive: true })
    writeFileSync(join(outside, 'secret.md'), 'fuera del proyecto')
    symlinkSync(outside, join(cwd, '.gravity', 'escape-dir'), 'dir')
    expect(resolveTabContextRevealPath(cwd, 'escape-dir/secret.md')).toEqual({
      ok: false,
      error: 'ruta fuera del proyecto',
    })
  })
})
