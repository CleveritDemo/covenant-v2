import { useEffect, useState } from 'react'
import { PREVIEW_MAX_BYTES, type FilePreviewKind } from '@shared/filePreviewKind'

export type FileBytesState =
  | { status: 'loading' }
  | { status: 'ready'; bytes: Uint8Array }
  | { status: 'error'; message: string }
  | { status: 'too-large'; sizeBytes: number; maxBytes: number }

/**
 * Carga los bytes de un archivo para los visores binarios.
 *
 * El `gen` evita que una carga lenta pise a una posterior: si cambias de archivo
 * mientras el PDF grande sigue leyéndose, la respuesta vieja se descarta en vez
 * de pintarse encima de la nueva.
 */
export function useFileBytes(
  sessionId: string,
  relPath: string,
  kind: FilePreviewKind,
): FileBytesState {
  const [state, setState] = useState<FileBytesState>({ status: 'loading' })

  useEffect(() => {
    let cancelled = false
    setState({ status: 'loading' })

    void (async () => {
      try {
        const payload = await window.api.fileExplorerLoadBytes(
          sessionId,
          relPath,
          PREVIEW_MAX_BYTES[kind],
        )
        if (cancelled) return
        if (!payload.ok || !payload.bytes) {
          if (payload.code === 'FILE_TOO_LARGE') {
            setState({
              status: 'too-large',
              sizeBytes: payload.sizeBytes ?? 0,
              maxBytes: payload.maxBytes ?? PREVIEW_MAX_BYTES[kind],
            })
            return
          }
          setState({ status: 'error', message: payload.error ?? 'no se pudo leer el archivo' })
          return
        }
        // La IPC entrega un Uint8Array por clonado estructurado; no hay que
        // deserializar nada (Covenant classic mandaba un JSON de number[]).
        setState({ status: 'ready', bytes: payload.bytes })
      } catch (e) {
        if (!cancelled) setState({ status: 'error', message: e instanceof Error ? e.message : String(e) })
      }
    })()

    return () => {
      cancelled = true
    }
  }, [sessionId, relPath, kind])

  return state
}

/** Object URL vivo mientras el componente esté montado; se revoca al desmontar. */
export function useBlobUrl(bytes: Uint8Array | null, mimeType?: string): string | null {
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!bytes) {
      setUrl(null)
      return
    }
    // Se copia a un ArrayBuffer propio: `bytes` puede ser una vista sobre un
    // buffer mayor y Blob se llevaría de más.
    const copy = bytes.slice()
    const blob = new Blob([copy], mimeType ? { type: mimeType } : undefined)
    const next = URL.createObjectURL(blob)
    setUrl(next)
    return () => {
      URL.revokeObjectURL(next)
    }
  }, [bytes, mimeType])

  return url
}
