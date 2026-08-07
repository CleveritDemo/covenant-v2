import { createHash } from 'crypto'
import { execFileSync } from 'child_process'
import { lstatSync, readFileSync, readdirSync } from 'fs'
import { join, relative, resolve, sep } from 'path'
import { PROJECT_DIRS } from '../src/shared/projectDir'

export type WorkspaceSnapshot = Map<string, string>

const SKIPPED_DIRECTORIES = new Set([
  '.git', ...PROJECT_DIRS, 'node_modules', 'out', 'dist', 'build', 'coverage', '.next',
  '.Trash', '.Trashes', '$Recycle.Bin', 'Library', 'Applications',
])
const MAX_HASH_BYTES = 20 * 1024 * 1024
/** Tope del fallback sin git: evita escanear el home entero. */
const MAX_WALK_FILES = 8_000

function normalizedPath(value: string): string {
  return value.split(sep).join('/').replace(/^\.\/+/, '')
}

function gitFiles(root: string): string[] | null {
  try {
    const output = execFileSync(
      'git',
      ['ls-files', '--cached', '--others', '--exclude-standard', '-z'],
      {
        cwd: root,
        encoding: 'utf8',
        maxBuffer: 20 * 1024 * 1024,
        stdio: ['ignore', 'pipe', 'ignore'],
      },
    )
    return output.split('\0').filter(Boolean)
  } catch {
    return null
  }
}

function shouldSkipDirectory(name: string): boolean {
  if (SKIPPED_DIRECTORIES.has(name)) return true
  // Directorios ocultos del sistema/home (.Trash, .ssh, …) suelen denegar
  // readdir con EPERM y no aportan evidencia útil al filtro de anotaciones.
  if (name.startsWith('.') && name !== '.') return true
  return false
}

function walkFiles(root: string, directory = root, out: string[] = []): string[] {
  if (out.length >= MAX_WALK_FILES) return out
  let entries
  try {
    entries = readdirSync(directory, { withFileTypes: true })
  } catch {
    // EPERM/EACCES (p. ej. ~/.Trash) u otros fallos de lectura: saltar.
    return out
  }
  for (const entry of entries) {
    if (out.length >= MAX_WALK_FILES) break
    const absolute = join(directory, entry.name)
    try {
      if (entry.isDirectory()) {
        if (!shouldSkipDirectory(entry.name)) {
          walkFiles(root, absolute, out)
        }
      } else if (entry.isFile()) {
        out.push(relative(root, absolute))
      }
    } catch {
      // Entrada inaccesible o race (borrada entre listado y lstat): continuar.
    }
  }
  return out
}

function fingerprint(filePath: string): string | null {
  try {
    const stat = lstatSync(filePath)
    if (!stat.isFile()) return null
    if (stat.size > MAX_HASH_BYTES) {
      return `metadata:${stat.size}:${stat.mtimeMs}:${stat.ctimeMs}`
    }
    return createHash('sha256').update(readFileSync(filePath)).digest('hex')
  } catch {
    return null
  }
}

export function captureWorkspaceSnapshot(cwd: string): WorkspaceSnapshot {
  const root = resolve(cwd)
  const snapshot: WorkspaceSnapshot = new Map()
  let paths: string[]
  try {
    paths = gitFiles(root) ?? walkFiles(root)
  } catch {
    return snapshot
  }
  for (const path of paths) {
    const normalized = normalizedPath(path)
    if (!normalized || PROJECT_DIRS.some(dir => normalized.startsWith(`${dir}/`))) continue
    const value = fingerprint(join(root, path))
    if (value) snapshot.set(normalized, value)
  }
  return snapshot
}

export function changedWorkspacePaths(
  before: WorkspaceSnapshot,
  after: WorkspaceSnapshot,
): string[] {
  const changed = new Set<string>()
  for (const [path, fingerprint] of before) {
    if (after.get(path) !== fingerprint) changed.add(path)
  }
  for (const [path, fingerprint] of after) {
    if (before.get(path) !== fingerprint) changed.add(path)
  }
  return [...changed].sort()
}
