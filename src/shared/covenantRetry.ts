import type { CovenantResult } from './covenantTypes'

/**
 * Reintenta una llamada Covenant que devuelve `CovenantResult` (nunca rechaza) hasta
 * `attempts` veces con backoff lineal, antes de aceptar el fallo. Cubre hiccups de red
 * transitorios en el boot: sin esto, un solo intento fallido deja el catálogo del
 * workspace org vacío por el resto de la sesión (hasta un resync manual).
 */
export async function retryCovenantResult<T>(
  fn: () => Promise<CovenantResult<T>>,
  attempts = 3,
  delayMs = 400,
): Promise<CovenantResult<T>> {
  let last: CovenantResult<T> = { ok: false, error: 'retryCovenantResult: sin intentos' }
  for (let i = 0; i < attempts; i++) {
    last = await fn()
    if (last.ok) return last
    if (i < attempts - 1) {
      await new Promise(resolve => setTimeout(resolve, delayMs * (i + 1)))
    }
  }
  return last
}
