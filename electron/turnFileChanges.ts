import { createHash } from 'crypto'
import { execFileSync } from 'child_process'
import { lstatSync, readFileSync, readdirSync } from 'fs'
import { join, relative, resolve, sep } from 'path'

export type WorkspaceSnapshot = Map<string, string>

const SKIPPED_DIRECTORIES = new Set([
  '.git', '.iaterminal', 'node_modules', 'out', 'dist', 'build', 'coverage', '.next',
])
const MAX_HASH_BYTES = 20 * 1024 * 1024

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

function walkFiles(root: string, directory = root, out: string[] = []): string[] {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!SKIPPED_DIRECTORIES.has(entry.name)) {
        walkFiles(root, join(directory, entry.name), out)
      }
    } else if (entry.isFile()) {
      out.push(relative(root, join(directory, entry.name)))
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
  const paths = gitFiles(root) ?? walkFiles(root)
  const snapshot: WorkspaceSnapshot = new Map()
  for (const path of paths) {
    const normalized = normalizedPath(path)
    if (!normalized || normalized.startsWith('.iaterminal/')) continue
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
