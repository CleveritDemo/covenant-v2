import { dirname, extname, normalize, resolve } from 'path'
import { spawnSync } from 'child_process'
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'fs'
import type {
  FileExplorerEntry,
  FileExplorerFilePayload,
  FileExplorerListResult,
  FileExplorerSearchResult,
  FileExplorerWriteResult,
} from '../src/shared/fileExplorerTypes'
import { FILE_EXPLORER_ERROR_CODES } from '../src/shared/fileExplorerErrorCodes'
import { FILE_EXPLORER_HIDDEN_DIR_NAMES } from '../src/shared/fileExplorerHiddenDirs'
import { resolveSafeProjectPath, writeProjectFile } from './agentFileOps'
import { isExistingDirectory } from './shellCwdSync'

export const MAX_READ_BYTES = 600_000
const MAX_WRITE_BYTES = 600_000
const BINARY_PROBE_BYTES = 8192

const BINARY_EXTENSIONS = new Set([
  'png', 'jpg', 'jpeg', 'gif', 'webp', 'ico', 'bmp', 'pdf', 'zip', 'gz', 'tar',
  'woff', 'woff2', 'ttf', 'eot', 'mp3', 'mp4', 'mov', 'avi', 'exe', 'dll', 'so', 'dylib',
])

const HIDDEN_DIR_NAMES = FILE_EXPLORER_HIDDEN_DIR_NAMES

function resolveWorkingDir(cwdRaw: string): string | null {
  const trimmed = String(cwdRaw).trim()
  if (!trimmed) return null
  try {
    const dir = resolve(normalize(trimmed))
    return isExistingDirectory(dir) ? dir : null
  } catch {
    return null
  }
}

function normalizeRelPath(relPath: string): string {
  return String(relPath).trim().replace(/\\/g, '/').replace(/^\/+/, '').replace(/\/+$/, '')
}

function isBinaryFile(abs: string, name: string): boolean {
  const ext = extname(name).slice(1).toLowerCase()
  if (BINARY_EXTENSIONS.has(ext)) return true
  try {
    const st = statSync(abs)
    const probe = Math.min(st.size, BINARY_PROBE_BYTES)
    if (probe === 0) return false
    const buf = readFileSync(abs, { encoding: null, flag: 'r' }).subarray(0, probe)
    return buf.includes(0)
  } catch {
    return false
  }
}

export function listDirChildren(
  projectRootRaw: string,
  relPathRaw: string,
  showHiddenDirs = true,
): FileExplorerListResult {
  const projectRoot = resolveWorkingDir(projectRootRaw)
  if (!projectRoot) {
    return { ok: false, entries: [], error: 'cwd inválido', code: FILE_EXPLORER_ERROR_CODES.CWD_INVALID }
  }

  const relPath = normalizeRelPath(relPathRaw)
  const abs = relPath ? resolveSafeProjectPath(projectRoot, relPath) : projectRoot
  if (!abs) {
    return { ok: false, entries: [], error: 'ruta inválida', code: FILE_EXPLORER_ERROR_CODES.PATH_INVALID }
  }

  try {
    const st = statSync(abs)
    if (!st.isDirectory()) {
      return { ok: false, entries: [], error: 'no es un directorio', code: FILE_EXPLORER_ERROR_CODES.NOT_A_DIRECTORY }
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { ok: false, entries: [], error: msg, code: FILE_EXPLORER_ERROR_CODES.NOT_FOUND }
  }

  let dirents: import('fs').Dirent[]
  try {
    dirents = readdirSync(abs, { withFileTypes: true })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { ok: false, entries: [], error: msg, code: FILE_EXPLORER_ERROR_CODES.LOAD_FAILED }
  }

  const entries: FileExplorerEntry[] = []
  for (const d of dirents) {
    if (d.name === '.' || d.name === '..') continue
    if (!showHiddenDirs && d.isDirectory() && HIDDEN_DIR_NAMES.has(d.name)) continue

    const childRel = relPath ? `${relPath}/${d.name}` : d.name
    entries.push({
      name: d.name,
      relPath: childRel,
      isDirectory: d.isDirectory(),
    })
  }

  entries.sort((a, b) => {
    if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1
    return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
  })

  return { ok: true, entries }
}

export function loadFileForExplorer(
  projectRootRaw: string,
  relPath: string,
  options?: { allowLarge?: boolean },
): FileExplorerFilePayload {
  const projectRoot = resolveWorkingDir(projectRootRaw)
  if (!projectRoot) {
    return { ok: false, relPath, error: 'cwd inválido', code: FILE_EXPLORER_ERROR_CODES.CWD_INVALID }
  }

  const abs = resolveSafeProjectPath(projectRoot, relPath)
  if (!abs) {
    return { ok: false, relPath, error: 'ruta inválida', code: FILE_EXPLORER_ERROR_CODES.PATH_INVALID }
  }

  try {
    const st = statSync(abs)
    if (!st.isFile()) {
      return { ok: false, relPath, error: 'no es un archivo', code: FILE_EXPLORER_ERROR_CODES.NOT_A_FILE }
    }

    if (isBinaryFile(abs, relPath.split('/').pop() ?? relPath)) {
      return {
        ok: true,
        relPath,
        binary: true,
        sizeBytes: st.size,
        maxBytes: MAX_READ_BYTES,
      }
    }

    if (st.size > MAX_READ_BYTES && !options?.allowLarge) {
      return {
        ok: false,
        relPath,
        error: 'archivo demasiado grande',
        code: FILE_EXPLORER_ERROR_CODES.FILE_TOO_LARGE,
        sizeBytes: st.size,
        maxBytes: MAX_READ_BYTES,
      }
    }

    return { ok: true, relPath, content: readFileSync(abs, 'utf-8'), sizeBytes: st.size }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { ok: false, relPath, error: msg, code: FILE_EXPLORER_ERROR_CODES.LOAD_FAILED }
  }
}

export function saveFileForExplorer(
  projectRootRaw: string,
  relPathRaw: string,
  content: string,
): FileExplorerWriteResult {
  const relPath = normalizeRelPath(relPathRaw)
  if (!relPath) {
    return { ok: false, error: 'ruta vacía', code: FILE_EXPLORER_ERROR_CODES.EMPTY_PATH }
  }
  const bytes = Buffer.byteLength(content, 'utf-8')
  if (bytes > MAX_WRITE_BYTES) {
    return { ok: false, error: 'archivo demasiado grande para guardar', code: FILE_EXPLORER_ERROR_CODES.FILE_TOO_LARGE }
  }
  const projectRoot = resolveWorkingDir(projectRootRaw)
  if (!projectRoot) {
    return { ok: false, error: 'cwd inválido', code: FILE_EXPLORER_ERROR_CODES.CWD_INVALID }
  }
  const result = writeProjectFile(projectRoot, relPath, content)
  if (!result.ok) {
    return { ok: false, error: result.error, code: FILE_EXPLORER_ERROR_CODES.SAVE_FAILED }
  }
  return { ok: true }
}

export function createFileForExplorer(
  projectRootRaw: string,
  relPathRaw: string,
): FileExplorerWriteResult {
  const relPath = normalizeRelPath(relPathRaw)
  if (!relPath) {
    return { ok: false, error: 'ruta vacía', code: FILE_EXPLORER_ERROR_CODES.EMPTY_PATH }
  }
  const projectRoot = resolveWorkingDir(projectRootRaw)
  if (!projectRoot) {
    return { ok: false, error: 'cwd inválido', code: FILE_EXPLORER_ERROR_CODES.CWD_INVALID }
  }
  const abs = resolveSafeProjectPath(projectRoot, relPath)
  if (!abs) {
    return { ok: false, error: 'ruta inválida o fuera del proyecto', code: FILE_EXPLORER_ERROR_CODES.PATH_INVALID }
  }
  if (existsSync(abs)) {
    return { ok: false, error: 'el archivo ya existe', code: FILE_EXPLORER_ERROR_CODES.FILE_EXISTS }
  }
  try {
    mkdirSync(dirname(abs), { recursive: true })
    writeFileSync(abs, '', { encoding: 'utf-8', flag: 'wx' })
    return { ok: true }
  } catch (e) {
    const err = e as NodeJS.ErrnoException
    if (err.code === 'EEXIST') {
      return { ok: false, error: 'el archivo ya existe', code: FILE_EXPLORER_ERROR_CODES.FILE_EXISTS }
    }
    const msg = e instanceof Error ? e.message : String(e)
    return { ok: false, error: msg, code: FILE_EXPLORER_ERROR_CODES.SAVE_FAILED }
  }
}

export function createDirForExplorer(
  projectRootRaw: string,
  relPathRaw: string,
): FileExplorerWriteResult {
  const relPath = normalizeRelPath(relPathRaw)
  if (!relPath) {
    return { ok: false, error: 'ruta vacía', code: FILE_EXPLORER_ERROR_CODES.EMPTY_PATH }
  }
  const projectRoot = resolveWorkingDir(projectRootRaw)
  if (!projectRoot) {
    return { ok: false, error: 'cwd inválido', code: FILE_EXPLORER_ERROR_CODES.CWD_INVALID }
  }
  const abs = resolveSafeProjectPath(projectRoot, relPath)
  if (!abs) {
    return { ok: false, error: 'ruta inválida o fuera del proyecto', code: FILE_EXPLORER_ERROR_CODES.PATH_INVALID }
  }
  if (existsSync(abs)) {
    return { ok: false, error: 'la carpeta ya existe', code: FILE_EXPLORER_ERROR_CODES.DIR_EXISTS }
  }
  try {
    mkdirSync(abs, { recursive: true })
    return { ok: true }
  } catch (e) {
    const err = e as NodeJS.ErrnoException
    if (err.code === 'EEXIST') {
      return { ok: false, error: 'la carpeta ya existe', code: FILE_EXPLORER_ERROR_CODES.DIR_EXISTS }
    }
    const msg = e instanceof Error ? e.message : String(e)
    return { ok: false, error: msg, code: FILE_EXPLORER_ERROR_CODES.SAVE_FAILED }
  }
}

export function deletePathForExplorer(
  projectRootRaw: string,
  relPathRaw: string,
): FileExplorerWriteResult {
  const relPath = normalizeRelPath(relPathRaw)
  if (!relPath) {
    return { ok: false, error: 'ruta vacía', code: FILE_EXPLORER_ERROR_CODES.EMPTY_PATH }
  }
  const projectRoot = resolveWorkingDir(projectRootRaw)
  if (!projectRoot) {
    return { ok: false, error: 'cwd inválido', code: FILE_EXPLORER_ERROR_CODES.CWD_INVALID }
  }
  const abs = resolveSafeProjectPath(projectRoot, relPath)
  if (!abs) {
    return { ok: false, error: 'ruta inválida o fuera del proyecto', code: FILE_EXPLORER_ERROR_CODES.PATH_INVALID }
  }
  try {
    rmSync(abs, { recursive: true, force: true })
    return { ok: true }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { ok: false, error: msg, code: FILE_EXPLORER_ERROR_CODES.DELETE_FAILED }
  }
}

export function renamePathForExplorer(
  projectRootRaw: string,
  oldRelPathRaw: string,
  newRelPathRaw: string,
): FileExplorerWriteResult {
  const oldRel = normalizeRelPath(oldRelPathRaw)
  const newRel = normalizeRelPath(newRelPathRaw)
  if (!oldRel || !newRel) {
    return { ok: false, error: 'ruta vacía', code: FILE_EXPLORER_ERROR_CODES.EMPTY_PATH }
  }
  if (oldRel === newRel) {
    return { ok: true }
  }
  const projectRoot = resolveWorkingDir(projectRootRaw)
  if (!projectRoot) {
    return { ok: false, error: 'cwd inválido', code: FILE_EXPLORER_ERROR_CODES.CWD_INVALID }
  }
  const oldAbs = resolveSafeProjectPath(projectRoot, oldRel)
  const newAbs = resolveSafeProjectPath(projectRoot, newRel)
  if (!oldAbs || !newAbs) {
    return { ok: false, error: 'ruta inválida o fuera del proyecto', code: FILE_EXPLORER_ERROR_CODES.PATH_INVALID }
  }
  try {
    statSync(oldAbs)
  } catch {
    return { ok: false, error: 'el elemento no existe', code: FILE_EXPLORER_ERROR_CODES.NOT_FOUND }
  }
  try {
    statSync(newAbs)
    return { ok: false, error: 'ya existe un elemento con ese nombre', code: FILE_EXPLORER_ERROR_CODES.DEST_EXISTS }
  } catch {
    // destino libre
  }
  try {
    mkdirSync(dirname(newAbs), { recursive: true })
    renameSync(oldAbs, newAbs)
    return { ok: true }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { ok: false, error: msg, code: FILE_EXPLORER_ERROR_CODES.RENAME_FAILED }
  }
}

export function movePathForExplorer(
  projectRootRaw: string,
  oldRelPathRaw: string,
  newRelPathRaw: string,
): FileExplorerWriteResult {
  return renamePathForExplorer(projectRootRaw, oldRelPathRaw, newRelPathRaw)
}

export function revealPathForExplorer(
  projectRootRaw: string,
  relPathRaw: string,
): { ok: true; absPath: string } | { ok: false; error: string; code?: string } {
  const relPath = normalizeRelPath(relPathRaw)
  if (!relPath) {
    return { ok: false, error: 'ruta vacía', code: FILE_EXPLORER_ERROR_CODES.EMPTY_PATH }
  }
  const projectRoot = resolveWorkingDir(projectRootRaw)
  if (!projectRoot) {
    return { ok: false, error: 'cwd inválido', code: FILE_EXPLORER_ERROR_CODES.CWD_INVALID }
  }
  const abs = resolveSafeProjectPath(projectRoot, relPath)
  if (!abs || !existsSync(abs)) {
    return { ok: false, error: 'no encontrado', code: FILE_EXPLORER_ERROR_CODES.NOT_FOUND }
  }
  return { ok: true, absPath: abs }
}

export const FILE_EXPLORER_SEARCH_MAX_RESULTS = 200
const FILE_EXPLORER_SEARCH_TIMEOUT_MS = 8_000

const SEARCH_SKIP_GLOBS = [
  '!node_modules/**',
  '!.git/**',
  '!dist/**',
  '!build/**',
  '!.next/**',
  '!out/**',
  '!coverage/**',
]

/**
 * Búsqueda global de archivos con `rg --files` (fallback a recorrido superficial).
 */
export function searchProjectFiles(
  projectRootRaw: string,
  queryRaw: unknown,
): FileExplorerSearchResult {
  const projectRoot = resolveWorkingDir(projectRootRaw)
  if (!projectRoot) {
    return {
      ok: false,
      paths: [],
      hits: [],
      error: 'cwd inválido',
      code: FILE_EXPLORER_ERROR_CODES.CWD_INVALID,
    }
  }

  const query = String(queryRaw ?? '').trim().toLowerCase()
  if (!query) return { ok: true, paths: [], hits: [] }

  const globPattern = `*${query.replace(/[*?[\]{}]/g, '')}*`
  const rgPaths = runRgFileSearch(projectRoot, globPattern)
  if (rgPaths) {
    // rg --files solo lista archivos; también buscar dirs por nombre en walk superficial
    const fileHits = rgPaths.map(rel => ({ relPath: rel, isDirectory: false }))
    const dirHits = collectMatchingDirs(projectRoot, query, FILE_EXPLORER_SEARCH_MAX_RESULTS - fileHits.length)
    const hits = [...fileHits, ...dirHits].slice(0, FILE_EXPLORER_SEARCH_MAX_RESULTS)
    return {
      ok: true,
      paths: hits.map(h => h.relPath),
      hits,
      truncated: hits.length >= FILE_EXPLORER_SEARCH_MAX_RESULTS || rgPaths.length >= FILE_EXPLORER_SEARCH_MAX_RESULTS,
    }
  }

  const hits: Array<{ relPath: string; isDirectory: boolean }> = []
  const walk = (dir: string, relPrefix: string, depth: number): void => {
    if (hits.length >= FILE_EXPLORER_SEARCH_MAX_RESULTS || depth > 6) return
    let dirents: import('fs').Dirent[]
    try {
      dirents = readdirSync(dir, { withFileTypes: true })
    } catch {
      return
    }
    dirents.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))
    for (const e of dirents) {
      if (hits.length >= FILE_EXPLORER_SEARCH_MAX_RESULTS) break
      if (e.name.startsWith('.')) continue
      if (e.isDirectory()) {
        if (HIDDEN_DIR_NAMES.has(e.name)) continue
        const rel = relPrefix ? `${relPrefix}/${e.name}` : e.name
        if (e.name.toLowerCase().includes(query) || rel.toLowerCase().includes(query)) {
          hits.push({ relPath: rel, isDirectory: true })
        }
        walk(resolve(dir, e.name), rel, depth + 1)
        continue
      }
      if (!e.isFile()) continue
      const rel = relPrefix ? `${relPrefix}/${e.name}` : e.name
      if (e.name.toLowerCase().includes(query) || rel.toLowerCase().includes(query)) {
        hits.push({ relPath: rel, isDirectory: false })
      }
    }
  }
  walk(projectRoot, '', 0)
  return {
    ok: true,
    paths: hits.map(h => h.relPath),
    hits,
    truncated: hits.length >= FILE_EXPLORER_SEARCH_MAX_RESULTS,
  }
}

function collectMatchingDirs(
  projectRoot: string,
  query: string,
  max: number,
): Array<{ relPath: string; isDirectory: boolean }> {
  if (max <= 0) return []
  const hits: Array<{ relPath: string; isDirectory: boolean }> = []
  const walk = (dir: string, relPrefix: string, depth: number): void => {
    if (hits.length >= max || depth > 6) return
    let dirents: import('fs').Dirent[]
    try {
      dirents = readdirSync(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const e of dirents) {
      if (hits.length >= max) break
      if (!e.isDirectory() || e.name.startsWith('.')) continue
      if (HIDDEN_DIR_NAMES.has(e.name)) continue
      const rel = relPrefix ? `${relPrefix}/${e.name}` : e.name
      if (e.name.toLowerCase().includes(query) || rel.toLowerCase().includes(query)) {
        hits.push({ relPath: rel, isDirectory: true })
      }
      walk(resolve(dir, e.name), rel, depth + 1)
    }
  }
  walk(projectRoot, '', 0)
  return hits
}

function runRgFileSearch(projectRoot: string, globPattern: string): string[] | null {
  try {
    const args = [
      '--files',
      '-g',
      globPattern,
      ...SEARCH_SKIP_GLOBS.flatMap(g => ['--glob', g]),
    ]
    const r = spawnSync('rg', args, {
      cwd: projectRoot,
      encoding: 'utf-8',
      timeout: FILE_EXPLORER_SEARCH_TIMEOUT_MS,
      maxBuffer: FILE_EXPLORER_SEARCH_MAX_RESULTS * 256,
    })
    if (r.error || (r.status !== 0 && !r.stdout?.trim())) return null
    return r.stdout
      .split('\n')
      .map(l => l.trim().replace(/\\/g, '/'))
      .filter(Boolean)
      .slice(0, FILE_EXPLORER_SEARCH_MAX_RESULTS)
  } catch {
    return null
  }
}
