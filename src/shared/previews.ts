export const PREVIEW_MAX_BYTES = 2_000_000

export type PreviewEntry = {
  fileName: string
  stem: string
  title: string
  mtimeMs: number
  sizeBytes: number
  filePath: string
}

export type PreviewsListResult =
  | { ok: true; previews: PreviewEntry[] }
  | { ok: false; error: string }

export type PreviewReadResult =
  | { ok: true; fileName: string; html: string; filePath: string }
  | { ok: false; error: string }

export function isPreviewFileName(name: string): boolean {
  if (name.includes('..') || name.includes('/') || name.includes('\\')) {
    return false
  }
  return /^[A-Za-z0-9._-]+\.(html|htm|svg)$/.test(name)
}

export function previewTitleFromHtml(html: string, stem: string): string {
  const match = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)
  if (match) {
    const title = match[1].trim().replace(/\s+/g, ' ')
    if (title) {
      return title.length > 120 ? title.slice(0, 120) : title
    }
  }
  return stem.replace(/[-_]/g, ' ')
}
