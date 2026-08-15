/**
 * Captura de errores no manejados del renderer.
 *
 * Un throw en render o en un efecto de commit hace que React desmonte el árbol
 * entero: `#root` queda vacío y solo se ve el fondo del tema — la app "en
 * negro", con el proceso vivo y sin `render-process-gone` que lo registre.
 * Estos handlers son el único rastro de ese caso.
 */

import type { RendererErrorReport } from '@shared/rendererErrorReport'
import { describeThrownValue } from '@shared/rendererErrorReport'

/** Tope de reportes por sesión: un error en bucle no debe llenar el log. */
const MAX_REPORTS = 50

let reportCount = 0

/** Envía el reporte a main. Nunca lanza: se usa desde handlers de error. */
export function reportRendererError(report: RendererErrorReport): void {
  if (reportCount >= MAX_REPORTS) return
  reportCount += 1
  try {
    window.api.reportRendererError({ url: window.location.href, ...report })
  } catch {
    /* preload no disponible: no hay nada mejor que hacer */
  }
}

/** Registra `window.onerror` y `unhandledrejection`. Idempotente. */
let installed = false
export function installRendererErrorReporting(): void {
  if (installed) return
  installed = true

  window.addEventListener('error', event => {
    const { message, stack } = describeThrownValue(event.error ?? event.message)
    reportRendererError({ source: 'window-onerror', message, stack })
  })

  window.addEventListener('unhandledrejection', event => {
    const { message, stack } = describeThrownValue(event.reason)
    reportRendererError({ source: 'unhandled-rejection', message, stack })
  })
}
