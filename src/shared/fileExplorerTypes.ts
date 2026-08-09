import type { FileExplorerErrorCode } from './fileExplorerErrorCodes'

export interface FileExplorerEntry {
  name: string
  /** Ruta relativa al cwd de la sesión, separador `/` */
  relPath: string
  isDirectory: boolean
}

export interface FileExplorerErrorPayload {
  error: string
  code?: FileExplorerErrorCode
}

export interface FileExplorerListResult {
  ok: boolean
  entries: FileExplorerEntry[]
  /**
   * Prefetch depth-1: hijos de subcarpetas listadas en `entries`.
   * Clave = relPath de la subcarpeta.
   */
  prefetched?: Record<string, FileExplorerEntry[]>
  error?: string
  code?: FileExplorerErrorCode
}

export interface FileExplorerFilePayload {
  ok: boolean
  relPath: string
  content?: string
  error?: string
  code?: FileExplorerErrorCode
  binary?: boolean
  sizeBytes?: number
  maxBytes?: number
}

export type FileExplorerWriteResult =
  | { ok: true }
  | ({ ok: false } & FileExplorerErrorPayload)

export type FileExplorerCreateFileResult = FileExplorerWriteResult

export type FileExplorerClipboardResult =
  | { ok: true; count?: number }
  | ({ ok: false; count?: number } & FileExplorerErrorPayload)

export interface FileExplorerSearchHit {
  relPath: string
  isDirectory: boolean
}

export interface FileExplorerSearchResult {
  ok: boolean
  /** Rutas relativas al cwd de la sesión (legacy; preferir `hits`). */
  paths: string[]
  hits?: FileExplorerSearchHit[]
  truncated?: boolean
  error?: string
  code?: FileExplorerErrorCode
}

export interface FileExplorerBytesPayload {
  ok: boolean
  relPath: string
  /** Contenido crudo. `undefined` cuando `ok` es false. */
  bytes?: Uint8Array
  sizeBytes?: number
  maxBytes?: number
  error?: string
  code?: FileExplorerFilePayload['code']
}
