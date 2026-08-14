/**
 * `fetch` para llamadas salientes del proceso main.
 *
 * El `fetch` global de main es el de undici: ignora el proxy del sistema (PAC
 * incluido) y valida TLS contra su propio bundle de CA, no el keychain. En una
 * red con proxy MITM corporativo eso muere con «fetch failed» aunque el mismo
 * `curl` funcione. `net.fetch` va por la pila de Chromium, que sí usa el proxy
 * del sistema y su trust store.
 *
 * ponytail: resolución perezosa de `electron` para no obligar a los tests a
 * mockearlo; si no está disponible (vitest, o antes de `app.whenReady`) cae al
 * global, que además es lo que los tests stubean.
 */

let electronFetch: typeof fetch | null | undefined

export function httpFetch(url: string, init?: RequestInit): Promise<Response> {
  if (electronFetch === undefined) {
    try {
      electronFetch = (require('electron') as typeof import('electron')).net.fetch as typeof fetch
    } catch {
      electronFetch = null
    }
  }
  return (electronFetch ?? fetch)(url, init)
}

/** «fetch failed» a secas no dice nada: el motivo real vive en `cause`. */
export function describeFetchError(error: unknown): string {
  if (!(error instanceof Error)) return String(error)
  const cause = (error as { cause?: unknown }).cause
  const detail = cause instanceof Error ? cause.message : cause ? String(cause) : ''
  return detail && !error.message.includes(detail) ? `${error.message}: ${detail}` : error.message
}
