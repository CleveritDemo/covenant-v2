import {
  closeSync,
  existsSync,
  openSync,
  readFileSync,
  readdirSync,
  readSync,
  rmSync,
  statSync,
} from 'fs'
import { isAbsolute, relative, resolve } from 'path'
import { projectDirPath } from './projectDir'
import {
  isPreviewFileName,
  previewTitleFromHtml,
  PREVIEW_MAX_BYTES,
  type PreviewReadResult,
  type PreviewsListResult,
} from '../src/shared/previews'

const TITLE_HEAD_BYTES = 4096

function stemFromFileName(fileName: string): string {
  return fileName.replace(/\.(html|htm|svg)$/i, '')
}

function safePreviewPath(previewsDir: string, fileName: string): string | null {
  if (!isPreviewFileName(fileName)) return null
  const root = resolve(previewsDir)
  const candidate = resolve(root, fileName)
  const rel = relative(root, candidate)
  if (rel.startsWith('..') || isAbsolute(rel) || rel.includes('/') || rel.includes('\\')) return null
  return candidate
}

function readTitleHead(filePath: string, stem: string): string {
  try {
    const fd = openSync(filePath, 'r')
    try {
      const buffer = Buffer.alloc(TITLE_HEAD_BYTES)
      const bytesRead = readSync(fd, buffer, 0, TITLE_HEAD_BYTES, 0)
      const head = buffer.toString('utf8', 0, bytesRead)
      return previewTitleFromHtml(head, stem)
    } finally {
      closeSync(fd)
    }
  } catch {
    return previewTitleFromHtml('', stem)
  }
}

export function listPreviews(cwd: string): PreviewsListResult {
  try {
    const previewsDir = projectDirPath(cwd, 'previews')
    if (!existsSync(previewsDir)) {
      return { ok: true, previews: [] }
    }
    const previews = readdirSync(previewsDir, { withFileTypes: true })
      .filter(entry => entry.isFile() && isPreviewFileName(entry.name))
      .map(entry => {
        const fileName = entry.name
        const filePath = resolve(previewsDir, fileName)
        const stat = statSync(filePath)
        const stem = stemFromFileName(fileName)
        return {
          fileName,
          stem,
          title: readTitleHead(filePath, stem),
          mtimeMs: stat.mtimeMs,
          sizeBytes: stat.size,
          filePath,
        }
      })
      .sort((a, b) => b.mtimeMs - a.mtimeMs)
    return { ok: true, previews }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) }
  }
}

export function readPreview(cwd: string, fileName: string): PreviewReadResult {
  try {
    if (!isPreviewFileName(fileName)) {
      return { ok: false, error: 'Nombre de archivo inválido.' }
    }
    const previewsDir = projectDirPath(cwd, 'previews')
    const filePath = safePreviewPath(previewsDir, fileName)
    if (!filePath) {
      return { ok: false, error: 'Nombre de archivo inválido.' }
    }
    if (!existsSync(filePath)) {
      return { ok: false, error: 'Archivo no encontrado.' }
    }
    const stat = statSync(filePath)
    if (stat.size > PREVIEW_MAX_BYTES) {
      return {
        ok: false,
        error: `El archivo supera el límite de ${PREVIEW_MAX_BYTES} bytes (${stat.size} bytes).`,
      }
    }
    const html = readFileSync(filePath, 'utf8')
    return { ok: true, fileName, html, filePath }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) }
  }
}

export function deletePreview(
  cwd: string,
  fileName: string,
): { ok: true } | { ok: false; error: string } {
  try {
    if (!isPreviewFileName(fileName)) {
      return { ok: false, error: 'Nombre de archivo inválido.' }
    }
    const previewsDir = projectDirPath(cwd, 'previews')
    const filePath = safePreviewPath(previewsDir, fileName)
    if (!filePath) {
      return { ok: false, error: 'Nombre de archivo inválido.' }
    }
    if (!existsSync(filePath)) {
      return { ok: false, error: 'Archivo no encontrado.' }
    }
    rmSync(filePath)
    return { ok: true }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) }
  }
}
