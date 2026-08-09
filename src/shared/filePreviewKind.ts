/**
 * Qué visor le corresponde a un archivo, si es que hay alguno.
 *
 * Vive en `shared` porque lo consultan los dos lados: el renderer para decidir
 * si ofrece el toggle Vista/Fuente, y el main para saber si tiene que mandar los
 * bytes crudos en vez de texto.
 */

export type FilePreviewKind =
  | 'markdown'
  | 'svg'
  | 'image'
  | 'html'
  | 'csv'
  | 'xlsx'
  | 'docx'
  | 'pdf'

/** Visores que necesitan los bytes del archivo, no su texto. */
const BINARY_KINDS = new Set<FilePreviewKind>(['image', 'xlsx', 'docx', 'pdf'])

export function filePreviewKindForPath(path: string): FilePreviewKind | null {
  const base = path.split('/').pop() ?? ''
  const dot = base.lastIndexOf('.')
  // `<= 0` y no `=== -1`: un dotfile sin extensión (`.gitignore`) tiene el punto
  // en la posición 0 y no es una extensión.
  if (dot <= 0) return null
  const ext = base.slice(dot + 1).toLowerCase()

  if (ext === 'md' || ext === 'markdown' || ext === 'mdx') return 'markdown'
  if (ext === 'html' || ext === 'htm') return 'html'
  if (ext === 'svg') return 'svg'
  if (ext === 'png' || ext === 'jpg' || ext === 'jpeg' || ext === 'gif'
    || ext === 'webp' || ext === 'bmp' || ext === 'ico' || ext === 'avif') {
    return 'image'
  }
  if (ext === 'csv' || ext === 'tsv') return 'csv'
  if (ext === 'xlsx' || ext === 'xls' || ext === 'xlsm' || ext === 'ods') return 'xlsx'
  if (ext === 'docx') return 'docx'
  if (ext === 'pdf') return 'pdf'
  return null
}

/** ¿Este visor se alimenta de bytes en vez de texto? */
export function previewNeedsBytes(kind: FilePreviewKind): boolean {
  return BINARY_KINDS.has(kind)
}

/**
 * ¿El archivo se puede seguir editando como texto? Un `.xlsx` o un `.pdf` son
 * binarios: mostrar su "fuente" no tiene sentido y editarla los corrompería.
 */
export function previewHasSource(kind: FilePreviewKind): boolean {
  return !previewNeedsBytes(kind)
}

/** Techos por tipo. Un visor no debe congelar la app por abrir algo enorme. */
export const PREVIEW_MAX_BYTES: Record<FilePreviewKind, number> = {
  markdown: 2_000_000,
  svg: 5_000_000,
  html: 5_000_000,
  csv: 10_000_000,
  image: 25_000_000,
  xlsx: 25_000_000,
  docx: 25_000_000,
  pdf: 100_000_000,
}
