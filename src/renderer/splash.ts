/**
 * Splash de `index.html` (markup estático + GravityHeroCanvas.css + Gravity.css).
 * No se borra del DOM al arrancar: queda oculto para poder relanzarlo desde
 * Ajustes → Developer sin reiniciar la app.
 */

/**
 * Mínimo en pantalla: montar puede tardar 200ms y el parpadeo se ve peor que la
 * espera. Da además para la entrada de `Gravity` (`gravity-enter`, 2.4s).
 */
export const SPLASH_MIN_MS = 2_600

/** Tope si el plano no reporta layout (evita splash eterno). */
export const SPLASH_READY_TIMEOUT_MS = 12_000

/**
 * Holdeo tras mínimo + layout listo, antes del fade: deja ver el plano estable
 * un instante sin que el overlay desaparezca al instante.
 */
export const SPLASH_SETTLE_MS = 500

/** Debe coincidir con la transición de `#splash` en GravityHeroCanvas.css. */
const FADE_MS = 500

function splashEl(): HTMLElement | null {
  return document.getElementById('splash')
}

function hide(el: HTMLElement): void {
  el.classList.add('is-done')
  setTimeout(() => el.classList.add('is-hidden'), FADE_MS)
}

function wait(ms: number): Promise<void> {
  return new Promise(resolve => {
    setTimeout(resolve, ms)
  })
}

/**
 * Gate one-shot del boot real: `markSplashUiReady` / `uiReadySettled` solo
 * resuelven `uiReadyPromise` una vez. `replaySplash` no reusa este gate (solo
 * espera MIN + settle opcional y oculta); no llama a markSplashUiReady.
 */
let uiReadySettled = false
let resolveUiReady: (() => void) | null = null
const uiReadyPromise = new Promise<void>(resolve => {
  resolveUiReady = resolve
})

/**
 * Gate one-shot del fundido de boot: `settleSplashDismissed` solo resuelve
 * `dismissedPromise` una vez. `replaySplash` no toca este gate.
 */
let dismissedSettled = false
let resolveDismissed: (() => void) | null = null
const dismissedPromise = new Promise<void>(resolve => {
  resolveDismissed = resolve
})

function settleSplashDismissed(): void {
  if (dismissedSettled) return
  dismissedSettled = true
  resolveDismissed?.()
  resolveDismissed = null
}

/**
 * Señala que la UI de arranque ya pintó el plano en su posición final.
 * Idempotente; `dismissSplash` espera esto (además del mínimo en pantalla).
 * One-shot de boot — ver nota sobre `uiReadySettled` arriba.
 */
export function markSplashUiReady(): void {
  if (uiReadySettled) return
  uiReadySettled = true
  resolveUiReady?.()
  resolveUiReady = null
}

/**
 * Resuelve cuando el splash de boot se funde (o ya no aplica).
 * One-shot e idempotente — ver nota sobre `dismissedSettled` arriba.
 * Si no hay `#splash` o ya está `is-hidden`, resuelve de inmediato.
 */
export function whenSplashDismissed(): Promise<void> {
  const el = splashEl()
  if (!el || el.classList.contains('is-hidden')) {
    return Promise.resolve()
  }
  return dismissedPromise
}

/**
 * Oculta el splash de inmediato, sin esperar mínimo ni layout. Solo para el
 * camino de error: si la UI reventó al arrancar, el overlay taparía el panel de
 * error y el usuario vería la animación colgada para siempre.
 */
export function hideSplashNow(): void {
  const el = splashEl()
  if (!el) {
    settleSplashDismissed()
    return
  }
  hide(el)
  settleSplashDismissed()
}

/** Lo funde tras el mínimo en pantalla y el layout listo; llamar al montar la app. */
export function dismissSplash(): void {
  const el = splashEl()
  if (!el) {
    settleSplashDismissed()
    return
  }
  const minWaitMs = Math.max(0, SPLASH_MIN_MS - performance.now())
  const minWait = wait(minWaitMs)
  const uiReady = Promise.race([
    uiReadyPromise,
    wait(SPLASH_READY_TIMEOUT_MS),
  ])
  void Promise.all([minWait, uiReady])
    .then(() => wait(SPLASH_SETTLE_MS))
    .then(() => {
      hide(el)
      settleSplashDismissed()
    })
}

/**
 * Vuelve a mostrar un ciclo completo (debug de la animación).
 * No resetea `uiReadySettled` / `uiReadyPromise` — ese gate es solo del boot.
 * No toca `dismissedSettled` / `dismissedPromise` — ese gate también es solo del boot.
 * Settle 0 a propósito (~SPLASH_MIN_MS); el boot real usa SPLASH_SETTLE_MS
 * vía `dismissSplash`.
 */
export function replaySplash(): void {
  const el = splashEl()
  if (!el) return
  el.classList.remove('is-hidden', 'is-done')
  void el.offsetWidth // reinicia las animaciones CSS que estaban en display:none
  void wait(SPLASH_MIN_MS).then(() => hide(el))
}
