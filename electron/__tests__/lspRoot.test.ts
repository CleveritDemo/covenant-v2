import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { dirname, join } from 'path'
import { afterEach, describe, expect, it } from 'vitest'
import { detectRoot } from '../lsp/root'

describe('detectRoot', () => {
  const dirs: string[] = []
  const tempDir = (): string => {
    const dir = mkdtempSync(join(tmpdir(), 'gravity-lsp-root-'))
    dirs.push(dir)
    return dir
  }
  const touch = (p: string): void => {
    mkdirSync(dirname(p), { recursive: true })
    writeFileSync(p, '')
  }

  afterEach(() => {
    while (dirs.length) rmSync(dirs.pop() as string, { recursive: true, force: true })
  })

  it('gana el marcador más externo (raíz de workspace sobre crate miembro)', () => {
    const t = tempDir()
    touch(join(t, 'ws/Cargo.toml'))
    touch(join(t, 'ws/member/Cargo.toml'))
    touch(join(t, 'ws/member/src/lib.rs'))
    expect(detectRoot(join(t, 'ws/member/src/lib.rs'), ['Cargo.toml'])).toBe(join(t, 'ws'))
  })

  it('cae a la raíz de git cuando no hay marcadores', () => {
    const t = tempDir()
    mkdirSync(join(t, 'repo/.git'), { recursive: true })
    touch(join(t, 'repo/src/main.rs'))
    expect(detectRoot(join(t, 'repo/src/main.rs'), ['Cargo.toml'])).toBe(join(t, 'repo'))
  })

  it('cae al directorio padre cuando no hay ni marcadores ni git', () => {
    const t = tempDir()
    touch(join(t, 'loose/file.rs'))
    expect(detectRoot(join(t, 'loose/file.rs'), ['Cargo.toml'])).toBe(join(t, 'loose'))
  })

  it('un marcador glob matchea cualquier archivo con esa extensión', () => {
    const t = tempDir()
    touch(join(t, 'proj/Foo.sln'))
    touch(join(t, 'proj/src/Program.cs'))
    const root = detectRoot(join(t, 'proj/src/Program.cs'), ['*.sln', '*.csproj', 'global.json'])
    expect(root).toBe(join(t, 'proj'))
  })

  it('con globs también gana el más externo', () => {
    const t = tempDir()
    touch(join(t, 'ws/Foo.sln'))
    touch(join(t, 'ws/lib/Bar.csproj'))
    touch(join(t, 'ws/lib/src/Class.cs'))
    expect(detectRoot(join(t, 'ws/lib/src/Class.cs'), ['*.sln', '*.csproj'])).toBe(join(t, 'ws'))
  })

  it('un glob no matchea una extensión ajena', () => {
    const t = tempDir()
    touch(join(t, 'proj/Notes.txt'))
    touch(join(t, 'proj/src/Program.cs'))
    mkdirSync(join(t, 'proj/.git'), { recursive: true })
    // Sin ningún *.sln: cae a la raíz de git.
    expect(detectRoot(join(t, 'proj/src/Program.cs'), ['*.sln'])).toBe(join(t, 'proj'))
  })
})
