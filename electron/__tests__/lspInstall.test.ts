import { createHash } from 'crypto'
import { execFileSync } from 'child_process'
import { gzipSync } from 'zlib'
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { dirname, join } from 'path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  entryPath,
  installedSize,
  installFromBytes,
  installRoot,
  isInstalled,
  removeInstall,
} from '../lsp/install'
import { platformKey, type ArchiveKind, type ServerSpec } from '../lsp/registry'

const sha = (b: Buffer): string => createHash('sha256').update(b).digest('hex')

function spec(overrides: Partial<ServerSpec> & { sha256: string; kind: ArchiveKind }): ServerSpec {
  const { sha256, kind, ...rest } = overrides
  return {
    language: 'rust',
    name: 'fake-ra',
    version: '1.0',
    cmd: 'fake-ra',
    args: [],
    rootMarkers: ['Cargo.toml'],
    approxSizeMb: 1,
    artifacts: {
      [platformKey()]: { url: 'https://example.invalid/x', sha256, kind },
    },
    ...rest,
  }
}

describe('install LSP', () => {
  const dirs: string[] = []
  const tempDir = (): string => {
    const dir = mkdtempSync(join(tmpdir(), 'gravity-lsp-install-'))
    dirs.push(dir)
    return dir
  }
  const isExecutable = (p: string): boolean => (statSync(p).mode & 0o111) !== 0

  afterEach(() => {
    while (dirs.length) rmSync(dirs.pop() as string, { recursive: true, force: true })
  })

  it('instala un gzip verificado y lo marca ejecutable', () => {
    const dir = tempDir()
    const payload = Buffer.from('#!/bin/sh\necho fake\n')
    const gz = gzipSync(payload)
    const s = spec({ sha256: sha(gz), kind: 'gzip' })

    const entry = installFromBytes(gz, s, dir)
    expect(entry).toBe(join(dir, 'lsp/fake-ra/1.0/fake-ra'))
    expect(readFileSync(entry)).toEqual(payload)
    expect(isInstalled(dir, s)).toBe(true)
    expect(isExecutable(entry)).toBe(true)
  })

  it('rechaza un sha256 que no cuadra y no instala nada', () => {
    const dir = tempDir()
    const gz = gzipSync(Buffer.from('payload'))
    const s = spec({ sha256: '0'.repeat(64), kind: 'gzip' })

    expect(() => installFromBytes(gz, s, dir)).toThrow(/sha256 mismatch/)
    expect(isInstalled(dir, s)).toBe(false)
    // El staging se limpia: un fallo no puede dejar basura que confunda al
    // siguiente intento de la misma versión.
    expect(existsSync(join(dir, 'lsp/fake-ra/1.0.staging'))).toBe(false)
  })

  it('una versión con puntos se stagea sin colisionar y recolecta la vieja', () => {
    // Regresión del original: derivar el staging reemplazando la "extensión"
    // convertía 4.3.0 en "4.3.staging", que colisiona con 4.3.1.
    const dir = tempDir()
    const oldGz = gzipSync(Buffer.from('#!/bin/sh\necho old\n'))
    const newGz = gzipSync(Buffer.from('#!/bin/sh\necho new\n'))
    const oldSpec = spec({ sha256: sha(oldGz), kind: 'gzip', version: '4.3.0' })
    const newSpec = spec({ sha256: sha(newGz), kind: 'gzip', version: '4.3.1' })

    expect(readFileSync(installFromBytes(oldGz, oldSpec, dir), 'utf8')).toContain('old')
    expect(readFileSync(installFromBytes(newGz, newSpec, dir), 'utf8')).toContain('new')

    expect(existsSync(installRoot(dir, oldSpec))).toBe(false)
    expect(isInstalled(dir, newSpec)).toBe(true)
  })

  it('installedSize es 0 sin instalar y el tamaño del entry después', () => {
    const dir = tempDir()
    const payload = Buffer.from('#!/bin/sh\necho un payload algo más largo\n')
    const gz = gzipSync(payload)
    const s = spec({ sha256: sha(gz), kind: 'gzip' })

    expect(installedSize(dir, s)).toBe(0)
    installFromBytes(gz, s, dir)
    expect(installedSize(dir, s)).toBe(payload.length)
  })

  it('removeInstall borra el dir de versión y es idempotente', () => {
    const dir = tempDir()
    const gz = gzipSync(Buffer.from('x'))
    const s = spec({ sha256: sha(gz), kind: 'gzip' })

    installFromBytes(gz, s, dir)
    expect(isInstalled(dir, s)).toBe(true)

    removeInstall(dir, s)
    expect(isInstalled(dir, s)).toBe(false)
    expect(existsSync(installRoot(dir, s))).toBe(false)
    expect(() => removeInstall(dir, s)).not.toThrow()
  })

  it('un spec npm resuelve el entry a binEntry bajo el installRoot', () => {
    const dir = tempDir()
    const s: ServerSpec = {
      language: 'typescript',
      name: 'fake-ts-ls',
      version: '1.2.3',
      cmd: 'fake-ts-ls',
      args: [],
      rootMarkers: ['package.json'],
      approxSizeMb: 1,
      runtime: { name: 'node', minVersion: '18', versionArg: '--version' },
      npm: { packages: ['fake-ts-ls@1.2.3'], binEntry: 'node_modules/fake-ts-ls/lib/cli.mjs' },
    }

    const expected = join(dir, 'lsp/fake-ts-ls/1.2.3/node_modules/fake-ts-ls/lib/cli.mjs')
    expect(entryPath(dir, s)).toBe(expected)
    expect(installRoot(dir, s)).toBe(join(dir, 'lsp/fake-ts-ls/1.2.3'))
    expect(isInstalled(dir, s)).toBe(false)

    mkdirSync(dirname(expected), { recursive: true })
    writeFileSync(expected, '#!/usr/bin/env node\n')
    expect(isInstalled(dir, s)).toBe(true)
  })

  it('instala un zip con entry anidado y sólo marca ejecutable ese entry', () => {
    // Espeja la forma del nupkg de Roslyn: payload bajo
    // content/LanguageServer/<rid>/ más otros archivos al lado.
    const src = tempDir()
    const entrySubpath = 'content/LanguageServer/osx-arm64/Microsoft.CodeAnalysis.LanguageServer'
    mkdirSync(join(src, dirname(entrySubpath)), { recursive: true })
    writeFileSync(join(src, entrySubpath), 'fake apphost bytes')
    chmodSync(join(src, entrySubpath), 0o644)
    mkdirSync(join(src, 'decoy'), { recursive: true })
    writeFileSync(join(src, 'decoy/reference.dll'), 'not the real payload')
    chmodSync(join(src, 'decoy/reference.dll'), 0o644)

    const zipPath = join(tempDir(), 'artifact.zip')
    execFileSync('zip', ['-q', '-r', zipPath, '.'], { cwd: src })
    const bytes = readFileSync(zipPath)

    const dir = tempDir()
    const s = spec({
      sha256: sha(bytes),
      kind: 'zip',
      language: 'csharp',
      name: 'fake-roslyn',
      cmd: 'unused-for-zip',
      entrySubpath,
    })

    const entry = installFromBytes(bytes, s, dir)
    expect(entry).toBe(join(dir, 'lsp/fake-roslyn/1.0', entrySubpath))
    expect(readFileSync(entry, 'utf8')).toBe('fake apphost bytes')
    expect(isInstalled(dir, s)).toBe(true)
    expect(isExecutable(entry)).toBe(true)

    // El archivo entero se desempaqueta, pero sólo el entry declarado queda
    // ejecutable, y el .zip temporal no sobrevive a la instalación.
    const decoy = join(dir, 'lsp/fake-roslyn/1.0/decoy/reference.dll')
    expect(existsSync(decoy)).toBe(true)
    expect(isExecutable(decoy)).toBe(false)
    expect(existsSync(join(dir, 'lsp/fake-roslyn/1.0/.archive-zip'))).toBe(false)
  })

  it('instala un tar.gz con entry anidado y conserva el árbol completo', () => {
    // Espeja la forma de jdtls: el jar del launcher bajo plugins/ y el dir de
    // configuración al lado, que el arranque del server necesita entero.
    const src = tempDir()
    const entrySubpath = 'plugins/org.eclipse.equinox.launcher_1.7.200.v1.jar'
    mkdirSync(join(src, 'plugins'), { recursive: true })
    writeFileSync(join(src, entrySubpath), 'fake equinox launcher jar bytes')
    chmodSync(join(src, entrySubpath), 0o644)
    mkdirSync(join(src, 'config_mac_arm'), { recursive: true })
    writeFileSync(join(src, 'config_mac_arm/config.ini'), 'osgi.bundles=fake')

    const tarPath = join(tempDir(), 'artifact.tar.gz')
    execFileSync('tar', ['-czf', tarPath, '-C', src, '.'])
    const bytes = readFileSync(tarPath)

    const dir = tempDir()
    const s = spec({
      sha256: sha(bytes),
      kind: 'targz',
      language: 'java',
      name: 'fake-jdtls',
      cmd: 'unused-for-targz',
      entrySubpath,
      configSubpath: 'config_mac_arm',
    })

    const entry = installFromBytes(bytes, s, dir)
    expect(entry).toBe(join(dir, 'lsp/fake-jdtls/1.0', entrySubpath))
    expect(readFileSync(entry, 'utf8')).toBe('fake equinox launcher jar bytes')
    expect(isExecutable(entry)).toBe(true)

    const configIni = join(dir, 'lsp/fake-jdtls/1.0/config_mac_arm/config.ini')
    expect(readFileSync(configIni, 'utf8')).toBe('osgi.bundles=fake')
  })

  it('un tar.gz con sha equivocado no deja nada instalado', () => {
    const src = tempDir()
    writeFileSync(join(src, 'payload'), 'x')
    const tarPath = join(tempDir(), 'artifact.tar.gz')
    execFileSync('tar', ['-czf', tarPath, '-C', src, '.'])

    const dir = tempDir()
    const s = spec({ sha256: '0'.repeat(64), kind: 'targz', entrySubpath: 'payload' })
    expect(() => installFromBytes(readFileSync(tarPath), s, dir)).toThrow(/sha256 mismatch/)
    expect(isInstalled(dir, s)).toBe(false)
  })
})
