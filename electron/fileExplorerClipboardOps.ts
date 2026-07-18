import { clipboard } from 'electron'
import { basename, extname, join, relative, resolve } from 'path'
import { cpSync, existsSync, renameSync, rmSync, statSync } from 'fs'
import { fileURLToPath } from 'url'
import { resolveSafeProjectPath } from './agentFileOps'
import { FILE_EXPLORER_ERROR_CODES } from '../src/shared/fileExplorerErrorCodes'
import type { FileExplorerClipboardResult } from '../src/shared/fileExplorerTypes'

interface ClipboardEntry {
  absPaths: string[]
  mode: 'copy' | 'cut'
}

const explorerClipboardBySession = new Map<string, ClipboardEntry>()

function getClipboardEntry(sessionId: string): ClipboardEntry {
  return explorerClipboardBySession.get(sessionId) ?? { absPaths: [], mode: 'copy' }
}

function setClipboardEntry(sessionId: string, entry: ClipboardEntry): void {
  explorerClipboardBySession.set(sessionId, entry)
}

function resolveWorkingDir(cwdRaw: string): string | null {
  try {
    const dir = resolve(String(cwdRaw).trim())
    const st = statSync(dir)
    return st.isDirectory() ? dir : null
  } catch {
    return null
  }
}

function normalizeRelPath(relPath: string): string {
  return String(relPath).trim().replace(/\\/g, '/').replace(/^\/+/, '').replace(/\/+$/, '')
}

function parseClipboardPathLine(line: string): string {
  const s = line.trim()
  if (!s) return ''
  if (s.startsWith('file://')) {
    try {
      return fileURLToPath(s)
    } catch {
      return ''
    }
  }
  return s
}

function readSystemClipboardAbsPaths(): string[] {
  const text = clipboard.readText().trim()
  if (!text) return []
  const paths: string[] = []
  for (const line of text.split(/\r?\n/)) {
    const p = parseClipboardPathLine(line)
    if (p && existsSync(p)) paths.push(p)
  }
  return paths
}

function uniqueDestAbs(destDir: string, name: string): string {
  const direct = join(destDir, name)
  if (!existsSync(direct)) return direct
  const ext = extname(name)
  const stem = ext ? basename(name, ext) : name
  for (let i = 1; i < 1000; i++) {
    const candidate = join(destDir, `${stem} (${i})${ext}`)
    if (!existsSync(candidate)) return candidate
  }
  throw new Error('demasiados archivos con el mismo nombre')
}

export function isPathInside(parentAbs: string, childAbs: string): boolean {
  const rel = relative(parentAbs, childAbs)
  return rel !== '' && !rel.startsWith('..')
}

function storeClipboard(sessionId: string, absPaths: string[], mode: 'copy' | 'cut'): void {
  setClipboardEntry(sessionId, { absPaths, mode })
  clipboard.writeText(absPaths.join('\n'))
}

export function copyPathsForExplorer(
  sessionId: string,
  projectRootRaw: string,
  relPathsRaw: string[],
): FileExplorerClipboardResult {
  const projectRoot = resolveWorkingDir(projectRootRaw)
  if (!projectRoot) {
    return { ok: false, error: 'cwd inválido', code: FILE_EXPLORER_ERROR_CODES.CWD_INVALID }
  }

  const absPaths: string[] = []

  for (const raw of relPathsRaw) {
    const rel = normalizeRelPath(raw)
    if (!rel) continue
    const abs = resolveSafeProjectPath(projectRoot, rel)
    if (!abs || !existsSync(abs)) {
      return { ok: false, error: `no existe: ${raw}`, code: FILE_EXPLORER_ERROR_CODES.NOT_FOUND }
    }
    absPaths.push(abs)
  }

  if (absPaths.length === 0) {
    return { ok: false, error: 'nada seleccionado para copiar', code: FILE_EXPLORER_ERROR_CODES.NOTHING_TO_COPY }
  }

  storeClipboard(sessionId, absPaths, 'copy')
  return { ok: true, count: absPaths.length }
}

export function cutPathsForExplorer(
  sessionId: string,
  projectRootRaw: string,
  relPathsRaw: string[],
): FileExplorerClipboardResult {
  const result = copyPathsForExplorer(sessionId, projectRootRaw, relPathsRaw)
  if (result.ok) {
    const entry = getClipboardEntry(sessionId)
    setClipboardEntry(sessionId, { ...entry, mode: 'cut' })
  }
  return result
}

export function pasteIntoExplorer(
  sessionId: string,
  projectRootRaw: string,
  destRelPathRaw: string,
): FileExplorerClipboardResult {
  const projectRoot = resolveWorkingDir(projectRootRaw)
  if (!projectRoot) {
    return { ok: false, error: 'cwd inválido', code: FILE_EXPLORER_ERROR_CODES.CWD_INVALID }
  }

  const destRel = normalizeRelPath(destRelPathRaw)
  const destDirAbs = destRel ? resolveSafeProjectPath(projectRoot, destRel) : projectRoot
  if (!destDirAbs) {
    return { ok: false, error: 'carpeta de destino inválida', code: FILE_EXPLORER_ERROR_CODES.PATH_INVALID }
  }

  try {
    const st = statSync(destDirAbs)
    if (!st.isDirectory()) {
      return { ok: false, error: 'el destino no es una carpeta', code: FILE_EXPLORER_ERROR_CODES.NOT_A_DIRECTORY }
    }
  } catch {
    return { ok: false, error: 'carpeta de destino no encontrada', code: FILE_EXPLORER_ERROR_CODES.NOT_FOUND }
  }

  const clipboardEntry = getClipboardEntry(sessionId)
  const sources: Array<{ srcAbs: string; name: string }> = []
  let mode = clipboardEntry.mode

  for (const abs of clipboardEntry.absPaths) {
    if (existsSync(abs)) {
      sources.push({ srcAbs: abs, name: basename(abs) })
    }
  }

  if (sources.length === 0) {
    for (const abs of readSystemClipboardAbsPaths()) {
      sources.push({ srcAbs: abs, name: basename(abs) })
    }
    if (sources.length > 0) {
      mode = 'copy'
    }
  }

  if (sources.length === 0) {
    return { ok: false, error: 'no hay nada en el portapapeles para pegar', code: FILE_EXPLORER_ERROR_CODES.NOTHING_TO_PASTE }
  }

  let pasted = 0

  for (const { srcAbs, name } of sources) {
    if (isPathInside(srcAbs, destDirAbs) || resolve(srcAbs) === resolve(destDirAbs)) {
      return {
        ok: false,
        count: pasted,
        error: 'no se puede pegar dentro de la propia selección',
        code: FILE_EXPLORER_ERROR_CODES.PASTE_INTO_SELF,
      }
    }
    const targetAbs = uniqueDestAbs(destDirAbs, name)
    try {
      const srcStat = statSync(srcAbs)
      if (mode === 'cut') {
        renameSync(srcAbs, targetAbs)
      } else {
        cpSync(srcAbs, targetAbs, srcStat.isDirectory() ? { recursive: true } : undefined)
      }
      pasted++
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      if (mode === 'cut' && pasted > 0) {
        // Algunos items ya se movieron; limpiar clipboard para no reintentar lo movido.
        setClipboardEntry(sessionId, { absPaths: [], mode: 'copy' })
      }
      return {
        ok: false,
        count: pasted,
        error: msg,
        code: FILE_EXPLORER_ERROR_CODES.PASTE_FAILED,
      }
    }
  }

  if (mode === 'cut') {
    setClipboardEntry(sessionId, { absPaths: [], mode: 'copy' })
  }

  return { ok: true, count: pasted }
}
